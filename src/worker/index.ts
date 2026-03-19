import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { query, execute, batchInsert, getOne } from "../lib/db";
import { downloadFile, writeToTempFile, deleteTempFile } from "../lib/storage";
import { classifyBatch } from "../lib/ai";
import { DEFAULT_TAXONOMY, getFullTaxonomy } from "../lib/defaultTaxonomy";
import type { BucketDefinition, AIProvider } from "../types";

// Parse CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^"|"$/g, ""));
}

// Parse full CSV text into array of row objects
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

const BATCH_SIZE = 25;

async function processAnalysisJob(job: Job) {
  const { analysisId, workbookId, jobId, column, provider } = job.data;

  try {
    // Update status to processing
    await execute(
      "UPDATE analyses SET status = 'processing', started_at = NOW() WHERE id = $1",
      [analysisId]
    );
    await execute(
      "UPDATE jobs SET status = 'processing', message = 'Downloading file...' WHERE id = $1",
      [jobId]
    );

    // Get workbook info
    const workbook = await getOne<{ storage_key: string; columns: string }>(
      "SELECT storage_key, columns FROM workbooks WHERE id = $1",
      [workbookId]
    );

    if (!workbook) throw new Error("Workbook not found");

    // Download CSV from R2
    const buffer = await downloadFile(workbook.storage_key);
    const csvText = buffer.toString("utf-8");
    const { headers, rows } = parseCSV(csvText);

    // Get custom buckets
    const customBucketRows = await query<{ bucket_name: string; description: string; direct_ancestor: string; root_category: string; include_terms: string; exclude_terms: string; example_strings: string }>(
      "SELECT * FROM custom_buckets"
    );
    const customBuckets: BucketDefinition[] = customBucketRows.map((r) => ({
      bucket_name: r.bucket_name,
      description: r.description || "",
      direct_ancestor: r.direct_ancestor || "",
      root_category: r.root_category || "",
      include: JSON.parse(r.include_terms || "[]"),
      exclude: JSON.parse(r.exclude_terms || "[]"),
      example_strings: JSON.parse(r.example_strings || "[]"),
    }));

    const taxonomy = getFullTaxonomy(customBuckets);

    // Update total rows
    await execute(
      "UPDATE analyses SET total_rows = $1 WHERE id = $2",
      [rows.length, analysisId]
    );

    let totalTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let exactMatches = 0;
    let aiClassified = 0;
    let generalCount = 0;
    const bucketDist: Record<string, number> = {};
    const allAnalysisRows: unknown[][] = [];

    // Process in batches
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      // Check for cancellation
      const jobRecord = await getOne<{ status: string }>(
        "SELECT status FROM jobs WHERE id = $1",
        [jobId]
      );
      if (jobRecord?.status === "cancelling") {
        await execute(
          "UPDATE analyses SET status = 'completed_partial', completed_at = NOW() WHERE id = $1",
          [analysisId]
        );
        await execute(
          "UPDATE jobs SET status = 'cancelled', message = 'Cancelled by user' WHERE id = $1",
          [jobId]
        );
        return;
      }

      const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
      const batch = rows.slice(batchStart, batchEnd);

      const values = batch.map((row, i) => ({
        index: batchStart + i,
        value: row[column] || "",
      }));

      const progress = Math.round((batchStart / rows.length) * 100);
      await execute(
        "UPDATE analyses SET progress = $1, message = $2, total_rows_processed = $3 WHERE id = $4",
        [progress, `Processing rows ${batchStart + 1}–${batchEnd}...`, batchStart, analysisId]
      );
      await execute(
        "UPDATE jobs SET progress = $1, message = $2 WHERE id = $3",
        [progress, `Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)}`, jobId]
      );

      try {
        const { results, tokenUsage } = await classifyBatch(
          values,
          taxonomy,
          provider as AIProvider,
        );

        totalTokens.promptTokens += tokenUsage.promptTokens;
        totalTokens.completionTokens += tokenUsage.completionTokens;
        totalTokens.totalTokens += tokenUsage.totalTokens;

        for (const res of results) {
          const row = rows[res.index];
          const bucketName = res.bucket_1.name || "General Industry";
          const isGeneric = res.generic || !res.bucket_1.name;
          const isDQ = res.disqualified;

          if (isGeneric) generalCount++;
          else if (res.bucket_1.score >= 0.8) exactMatches++;
          else aiClassified++;

          bucketDist[bucketName] = (bucketDist[bucketName] || 0) + 1;

          allAnalysisRows.push([
            analysisId,
            res.index,
            row[column] || "",
            JSON.stringify(row),
            bucketName,
            bucketName,
            res.bucket_3.name || null,
            res.bucket_2.name || null,
            res.bucket_1.score || null,
            res.bucket_1.reason || null,
            isGeneric,
            isDQ,
          ]);
        }
      } catch (batchError) {
        console.error(`Batch error at rows ${batchStart}-${batchEnd}:`, batchError);
        // Mark these rows as General Industry on error
        for (let i = batchStart; i < batchEnd; i++) {
          const row = rows[i];
          allAnalysisRows.push([
            analysisId, i, row[column] || "", JSON.stringify(row),
            "General Industry", "General Industry", null, null, null,
            "Batch classification error", true, false,
          ]);
          generalCount++;
          bucketDist["General Industry"] = (bucketDist["General Industry"] || 0) + 1;
        }
      }
    }

    // Batch insert all analysis rows
    if (allAnalysisRows.length > 0) {
      await batchInsert(
        "analysis_rows",
        [
          "analysis_id", "row_index", "original_value", "all_columns",
          "industry", "bucket_name", "root_category", "direct_ancestor",
          "confidence", "reason", "is_generic", "is_disqualified",
        ],
        allAnalysisRows
      );
    }

    // Update analysis as completed
    await execute(
      `UPDATE analyses SET 
         status = 'completed',
         progress = 100,
         message = 'Analysis complete',
         total_rows_processed = $1,
         exact_matches = $2,
         inclusive_matches = 0,
         ai_classified = $3,
         general_bucket_count = $4,
         token_usage = $5,
         bucket_distribution = $6,
         completed_at = NOW()
       WHERE id = $7`,
      [
        rows.length,
        exactMatches,
        aiClassified,
        generalCount,
        JSON.stringify(totalTokens),
        JSON.stringify(bucketDist),
        analysisId,
      ]
    );

    await execute(
      "UPDATE jobs SET status = 'completed', progress = 100, message = 'Done', result_id = $1 WHERE id = $2",
      [analysisId, jobId]
    );

    console.log(`>>> Analysis ${analysisId} completed: ${rows.length} rows processed`);
  } catch (error) {
    console.error(">>> Worker error:", error);
    await execute(
      "UPDATE analyses SET status = 'failed', message = $1 WHERE id = $2",
      [String(error), analysisId]
    );
    await execute(
      "UPDATE jobs SET status = 'failed', message = $1 WHERE id = $2",
      [String(error), jobId]
    );
  }
}

// Start worker
const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const worker = new Worker("workbook-analysis", processAnalysisJob, {
    connection,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`>>> Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`>>> Job ${job?.id} failed:`, error);
  });

  console.log(">>> Quantum Enricher worker started");
} else {
  console.warn(">>> REDIS_URL not set, worker not started");
}
