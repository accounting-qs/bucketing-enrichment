import { NextRequest, NextResponse } from "next/server";
import { query, getOne, execute, batchInsert } from "@/lib/db";
import { classifyBatch } from "@/lib/ai";
import { downloadFile } from "@/lib/storage";
import { getFullTaxonomy, DEFAULT_TAXONOMY } from "@/lib/defaultTaxonomy";
import { classifyDeterministic, applyBucketThreshold } from "@/lib/deterministicClassifier";
import type { BucketDefinition, AIProvider } from "@/types";

/** Safely parse a JSON string; returns fallback on any error */
function safeParseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn("safeParseJSON failed on:", String(raw).substring(0, 80));
    return fallback;
  }
}

// Parse CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else current += char;
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^"|"$/g, ""));
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j] || "";
    rows.push(row);
  }
  return { headers, rows };
}

const BATCH_SIZE = 25;
const PARALLEL_BATCHES = 2;

/**
 * Snap an AI-returned bucket name to the closest valid bucket.
 * If AI invents "Digital Health", this finds "Healthcare & Medical Services".
 */
function snapToValidBucket(aiName: string, taxonomy: BucketDefinition[]): string {
  if (!aiName || aiName.trim() === "") return "General Industry";

  const validNames = taxonomy.map(b => b.bucket_name);

  // Exact match (case-insensitive)
  const exact = validNames.find(v => v.toLowerCase() === aiName.toLowerCase());
  if (exact) return exact;

  // Fuzzy: score by word overlap between AI name and each bucket's name + include keywords
  const aiWords = new Set(aiName.toLowerCase().split(/[\s,&/]+/).filter(w => w.length > 2));
  let bestBucket = "General Industry";
  let bestScore = 0;

  for (const bucket of taxonomy) {
    if (bucket.bucket_name === "General Industry") continue;
    let score = 0;

    // Word overlap with bucket name
    const bWords = bucket.bucket_name.toLowerCase().split(/[\s,&/]+/).filter(w => w.length > 2);
    for (const w of bWords) {
      if (aiWords.has(w)) score += 3;
    }

    // Word overlap with include keywords
    for (const kw of bucket.include) {
      const kwWords = kw.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      for (const w of kwWords) {
        if (aiWords.has(w)) score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestBucket = bucket.bucket_name;
    }
  }

  // Require minimum score to avoid random assignment
  return bestScore >= 2 ? bestBucket : "General Industry";
}

// POST — start analysis (inline async processing without Redis)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workbookId } = await params;
    const {
      column,
      provider,
      projectId,
      model,
      analysisMode = "ai_only",
      rowLimit,
      minBucketThreshold = 1,
    } = await req.json();

    if (!column || !projectId) {
      return NextResponse.json({ error: "column and projectId required" }, { status: 400 });
    }
    if (analysisMode !== "deterministic_only" && !provider) {
      return NextResponse.json({ error: "provider required for AI modes" }, { status: 400 });
    }

    // Verify workbook
    const workbook = await getOne<{
      storage_key: string;
      columns: string;
      row_count: number;
    }>("SELECT storage_key, columns, row_count FROM workbooks WHERE id = $1", [workbookId]);
    if (!workbook) return NextResponse.json({ error: "Workbook not found" }, { status: 404 });

    const effectiveRows = rowLimit ? Math.min(rowLimit, workbook.row_count) : workbook.row_count;

    // Create analysis record
    const [analysis] = await query<{ id: string }>(
      `INSERT INTO analyses (project_id, workbook_id, selected_column, ai_provider, ai_model, status, total_rows, analysis_mode, row_limit, min_bucket_threshold)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)
       RETURNING *`,
      [projectId, workbookId, column, provider || "deterministic", model || null, effectiveRows, analysisMode, rowLimit || null, minBucketThreshold]
    );

    const analysisId = (analysis as Record<string, unknown>).id;

    // Create job record
    const [job] = await query<{ id: string }>(
      `INSERT INTO jobs (analysis_id, status, message)
       VALUES ($1, 'queued', 'Starting analysis...')
       RETURNING *`,
      [analysisId]
    );

    const jobId = (job as Record<string, unknown>).id;

    // Start inline async processing (non-blocking)
    processAnalysis(analysisId as string, jobId as string, workbookId, column, provider, model, analysisMode, effectiveRows, minBucketThreshold).catch((err) => {
      console.error(">>> Analysis processing error:", err);
    });

    return NextResponse.json({ analysis, job });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "Analysis failed to start" }, { status: 500 });
  }
}

async function processAnalysis(
  analysisId: string,
  jobId: string,
  workbookId: string,
  column: string,
  provider: string,
  model: string | null,
  analysisMode: string,
  effectiveRows: number,
  minBucketThreshold: number
) {
  try {
    await execute("UPDATE analyses SET status = 'processing', started_at = NOW() WHERE id = $1", [analysisId]);
    await execute("UPDATE jobs SET status = 'processing', message = 'Downloading file...' WHERE id = $1", [jobId]);

    // Get workbook and download CSV
    const workbook = await getOne<{ storage_key: string }>("SELECT storage_key FROM workbooks WHERE id = $1", [workbookId]);
    if (!workbook) throw new Error("Workbook not found");

    const buffer = await downloadFile(workbook.storage_key);
    const csvText = buffer.toString("utf-8");
    const { rows: allRows } = parseCSV(csvText);
    const rows = allRows.slice(0, effectiveRows);

    // Get taxonomy
    const customBucketRows = await query<{
      bucket_name: string; description: string; direct_ancestor: string;
      root_category: string; include_terms: string; exclude_terms: string; example_strings: string;
    }>("SELECT * FROM custom_buckets");

    const customBuckets: BucketDefinition[] = customBucketRows.map((r) => ({
      bucket_name: r.bucket_name,
      description: r.description || "",
      direct_ancestor: r.direct_ancestor || "",
      root_category: r.root_category || "",
      include: safeParseJSON<string[]>(r.include_terms, []),
      exclude: safeParseJSON<string[]>(r.exclude_terms, []),
      example_strings: safeParseJSON<string[]>(r.example_strings, []),
    }));

    const taxonomy = getFullTaxonomy(customBuckets);

    await execute("UPDATE analyses SET total_rows = $1 WHERE id = $2", [rows.length, analysisId]);

    let totalTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let exactMatches = 0, aiClassified = 0, generalCount = 0;
    const bucketDist: Record<string, number> = {};
    const allAnalysisRows: unknown[][] = [];
    let totalCostUsd = 0;

    const values = rows.map((row, i) => ({
      index: i,
      value: row[column] || "",
      allColumns: row,
    }));
    // ─── Deterministic Only ──────────────────────────────────
    if (analysisMode === "deterministic_only") {
      await execute("UPDATE jobs SET message = 'Running deterministic classifier...' WHERE id = $1", [jobId]);

      // Try DuckDB ensemble; if unavailable (Render cold start / native binding issue) fall back to JS
      let results: Array<{ index: number; value: string; bucket: string; confidence: number; method: string; reason: string }>;
      try {
        const { classifyWithEnsemble, applyBucketThresholdDuckDB } = await import("@/lib/duckdbEngine");
        await execute("UPDATE jobs SET message = 'Phase 1/4: Running ensemble (3 strategies: exact, fuzzy, fallback)...' WHERE id = $1", [jobId]);
        results = await classifyWithEnsemble(rows, column, taxonomy);
        await execute("UPDATE jobs SET message = 'Phase 4/4: Applying bucket thresholds...' WHERE id = $1", [jobId]);
        results = applyBucketThresholdDuckDB(results, minBucketThreshold);
      } catch (duckErr) {
        console.warn("DuckDB unavailable, using JS classifier:", String(duckErr).substring(0, 200));
        await execute("UPDATE jobs SET message = 'Running JS keyword classifier...' WHERE id = $1", [jobId]);
        const jsValues = rows.map((row, i) => ({ index: i, value: row[column] || "", allColumns: row }));
        let jsResults = classifyDeterministic(jsValues, taxonomy);
        jsResults = applyBucketThreshold(jsResults, minBucketThreshold);
        results = jsResults;
      }

      for (const res of results) {
        const row = rows[res.index];
        const bucketName = res.bucket;
        const isFallbackBucket = ["General Industry", "Needs Manual Review", "Error / Failed Enrichment"].includes(bucketName);
        if (isFallbackBucket) generalCount++;
        else if (res.confidence >= 0.8) exactMatches++;
        else aiClassified++;

        bucketDist[bucketName] = (bucketDist[bucketName] || 0) + 1;
        allAnalysisRows.push([
          analysisId, res.index, res.value, JSON.stringify(row),
          bucketName, bucketName, null, null,
          res.confidence, res.reason, isFallbackBucket, false, 0,
        ]);
      }

      await execute("UPDATE analyses SET progress = 100, message = 'Deterministic analysis complete' WHERE id = $1", [analysisId]);
    }
    // ─── Deterministic → AI ─────────────────────────────
    else if (analysisMode === "deterministic_then_ai") {
      await execute("UPDATE jobs SET message = 'Running DuckDB deterministic pass...' WHERE id = $1", [jobId]);

      let detResults;
      try {
        detResults = await classifyWithDuckDB(rows, column, taxonomy);
      } catch (duckErr) {
        console.warn("DuckDB failed, falling back to JS:", duckErr);
        const jsValues = rows.map((row, i) => ({ index: i, value: row[column] || "", allColumns: row }));
        detResults = classifyDeterministic(jsValues, taxonomy);
      }
      const confident = detResults.filter((r) => r.method === "deterministic");
      const needsAI = detResults.filter((r) => r.method === "needs_ai");

      // Store deterministic results
      for (const res of confident) {
        const row = rows[res.index];
        bucketDist[res.bucket] = (bucketDist[res.bucket] || 0) + 1;
        if (res.bucket === "General Industry") generalCount++;
        else exactMatches++;

        allAnalysisRows.push([
          analysisId, res.index, res.value, JSON.stringify(row),
          res.bucket, res.bucket, null, null,
          res.confidence, `[Deterministic] ${res.reason}`, res.bucket === "General Industry", false, 0,
        ]);
      }

      await execute(
        "UPDATE analyses SET progress = $1, message = $2 WHERE id = $3",
        [Math.round((confident.length / rows.length) * 100), `Deterministic: ${confident.length} classified. Running AI on ${needsAI.length} uncertain rows...`, analysisId]
      );

      // AI pass on uncertain rows
      if (needsAI.length > 0) {
        const aiValues = needsAI.map((r) => {
          const row = rows[r.index];
          // Build enriched value with all column context for the AI
          const allVals = Object.entries(row)
            .filter(([k, v]) => v && v.trim())
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ");
          return { index: r.index, value: allVals || r.value };
        });
        const aiResults = await processAIBatches(aiValues, taxonomy, provider as AIProvider, model, analysisId, jobId, rows, confident.length, rows.length);
        totalTokens = aiResults.tokenUsage;
        totalCostUsd = aiResults.totalCost;

        for (const res of aiResults.rows) {
          allAnalysisRows.push(res);
          const bName = res[4] as string;
          bucketDist[bName] = (bucketDist[bName] || 0) + 1;
          if (bName === "General Industry") generalCount++;
          else aiClassified++;
        }
      }
    }
    // ─── AI → Deterministic ─────────────────────────────
    else if (analysisMode === "ai_then_deterministic") {
      // Build enriched values with all column context for the AI
      const enrichedValues = values.map((v) => {
        const row = rows[v.index];
        const allVals = Object.entries(row)
          .filter(([k, val]) => val && val.trim())
          .map(([k, val]) => `${k}: ${val}`)
          .join(" | ");
        return { index: v.index, value: allVals || v.value };
      });
      const aiResults = await processAIBatches(enrichedValues, taxonomy, provider as AIProvider, model, analysisId, jobId, rows, 0, rows.length);
      totalTokens = aiResults.tokenUsage;
      totalCostUsd = aiResults.totalCost;

      // Then validate with deterministic
      await execute("UPDATE jobs SET message = 'Validating with deterministic engine...' WHERE id = $1", [jobId]);

      for (const rowData of aiResults.rows) {
        const idx = rowData[1] as number;
        const aiBucket = rowData[4] as string;
        const val = rowData[2] as string;

        // Re-check with deterministic
        const [detResult] = classifyDeterministic([{ index: idx, value: val }], taxonomy);
        let finalBucket = aiBucket;
        let finalReason = rowData[9] as string;

        if (detResult.method === "deterministic" && detResult.bucket !== aiBucket && detResult.confidence > 0.6) {
          finalBucket = detResult.bucket;
          finalReason = `[AI→Det override] AI: ${aiBucket} → Det: ${detResult.bucket} (${detResult.reason})`;
        }

        bucketDist[finalBucket] = (bucketDist[finalBucket] || 0) + 1;
        if (finalBucket === "General Industry") generalCount++;
        else aiClassified++;

        allAnalysisRows.push([
          analysisId, idx, val, rowData[3], finalBucket, finalBucket,
          rowData[6], rowData[7], rowData[8], finalReason, finalBucket === "General Industry", rowData[11], rowData[12],
        ]);
      }
    }
    // ─── AI Only ────────────────────────────────────────
    else {
      // Build enriched values with all column context for the AI
      const enrichedValues = values.map((v) => {
        const row = rows[v.index];
        const allVals = Object.entries(row)
          .filter(([k, val]) => val && val.trim())
          .map(([k, val]) => `${k}: ${val}`)
          .join(" | ");
        return { index: v.index, value: allVals || v.value };
      });
      const aiResults = await processAIBatches(enrichedValues, taxonomy, provider as AIProvider, model, analysisId, jobId, rows, 0, rows.length);
      totalTokens = aiResults.tokenUsage;
      totalCostUsd = aiResults.totalCost;

      for (const rowData of aiResults.rows) {
        allAnalysisRows.push(rowData);
        const bName = rowData[4] as string;
        bucketDist[bName] = (bucketDist[bName] || 0) + 1;
        if (bName === "General Industry") generalCount++;
        else if ((rowData[8] as number) >= 0.8) exactMatches++;
        else aiClassified++;
      }
    }

    // Apply threshold to final results if needed
    // (already handled per-row in deterministic modes)

    // Batch insert
    if (allAnalysisRows.length > 0) {
      await batchInsert("analysis_rows", [
        "analysis_id", "row_index", "original_value", "all_columns",
        "industry", "bucket_name", "root_category", "direct_ancestor",
        "confidence", "reason", "is_generic", "is_disqualified", "cost_usd",
      ], allAnalysisRows);
    }

    // Update analysis as completed
    await execute(
      `UPDATE analyses SET
         status = 'completed', progress = 100, message = 'Analysis complete',
         total_rows_processed = $1, exact_matches = $2, inclusive_matches = 0,
         ai_classified = $3, general_bucket_count = $4,
         token_usage = $5, bucket_distribution = $6,
         estimated_cost = $7, completed_at = NOW()
       WHERE id = $8`,
      [rows.length, exactMatches, aiClassified, generalCount,
        JSON.stringify(totalTokens), JSON.stringify(bucketDist),
        totalCostUsd, analysisId]
    );

    await execute("UPDATE jobs SET status = 'completed', progress = 100, message = 'Done', result_id = $1 WHERE id = $2", [analysisId, jobId]);

    console.log(`>>> Analysis ${analysisId} completed: ${rows.length} rows processed`);
  } catch (error) {
    console.error(">>> Analysis error:", error);
    await execute("UPDATE analyses SET status = 'failed', message = $1 WHERE id = $2", [String(error), analysisId]);
    await execute("UPDATE jobs SET status = 'failed', message = $1 WHERE id = $2", [String(error), jobId]);
  }
}

async function processAIBatches(
  values: { index: number; value: string }[],
  taxonomy: BucketDefinition[],
  provider: AIProvider,
  model: string | null,
  analysisId: string,
  jobId: string,
  rows: Record<string, string>[],
  processedSoFar: number,
  totalRows: number
): Promise<{
  rows: unknown[][];
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  totalCost: number;
}> {
  const tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const resultRows: unknown[][] = [];
  let totalCost = 0;

  // Process batches in parallel groups of PARALLEL_BATCHES
  for (let groupStart = 0; groupStart < values.length; groupStart += BATCH_SIZE * PARALLEL_BATCHES) {
    // Check for cancellation
    const jobRecord = await getOne<{ status: string }>("SELECT status FROM jobs WHERE id = $1", [jobId]);
    if (jobRecord?.status === "cancelling") {
      await execute("UPDATE analyses SET status = 'completed_partial', completed_at = NOW() WHERE id = $1", [analysisId]);
      break;
    }

    // Build parallel batch promises
    const parallelPromises: Promise<{ batchIndex: number; results?: Awaited<ReturnType<typeof classifyBatch>>; error?: unknown; batch: typeof values }>[] = [];

    for (let p = 0; p < PARALLEL_BATCHES; p++) {
      const batchStart = groupStart + p * BATCH_SIZE;
      if (batchStart >= values.length) break;

      const batchEnd = Math.min(batchStart + BATCH_SIZE, values.length);
      const batch = values.slice(batchStart, batchEnd);

      parallelPromises.push(
        classifyBatch(batch, taxonomy, provider, model || undefined)
          .then(result => ({ batchIndex: batchStart, results: result, batch }))
          .catch(error => ({ batchIndex: batchStart, error, batch }))
      );
    }

    // Update progress
    const groupEnd = Math.min(groupStart + BATCH_SIZE * PARALLEL_BATCHES, values.length);
    const progress = Math.round(((processedSoFar + groupStart) / totalRows) * 100);
    await execute("UPDATE analyses SET progress = $1, message = $2, total_rows_processed = $3 WHERE id = $4",
      [progress, `Processing rows ${groupStart + 1}–${groupEnd} of ${values.length} (${PARALLEL_BATCHES} parallel)...`, processedSoFar + groupStart, analysisId]
    );
    await execute("UPDATE jobs SET progress = $1, message = $2 WHERE id = $3",
      [progress, `Batch group ${Math.floor(groupStart / (BATCH_SIZE * PARALLEL_BATCHES)) + 1}/${Math.ceil(values.length / (BATCH_SIZE * PARALLEL_BATCHES))}`, jobId]
    );

    // Wait for all parallel batches
    const settled = await Promise.all(parallelPromises);

    for (const outcome of settled) {
      if (outcome.error || !outcome.results) {
        console.error(`[AI] Batch error at index ${outcome.batchIndex}:`, outcome.error instanceof Error ? outcome.error.message : outcome.error);
        for (const item of outcome.batch) {
          const row = rows[item.index];
          resultRows.push([
            analysisId, item.index, item.value, JSON.stringify(row),
            "General Industry", "General Industry", null, null,
            null, "Batch classification error", true, false, 0,
          ]);
        }
        continue;
      }

      const { results, tokenUsage: batchTokens } = outcome.results;
      tokenUsage.promptTokens += batchTokens.promptTokens;
      tokenUsage.completionTokens += batchTokens.completionTokens;
      tokenUsage.totalTokens += batchTokens.totalTokens;

      const batchCost = estimateBatchCost(batchTokens, provider, model);
      totalCost += batchCost;
      const costPerRow = outcome.batch.length > 0 ? batchCost / outcome.batch.length : 0;

      for (const res of results) {
        const row = rows[res.index];
        const originalValue = values.find(v => v.index === res.index)?.value || "";
        // CRITICAL: Snap AI bucket to valid taxonomy name (prevents extra buckets)
        const rawBucket = res.bucket_1.name || "General Industry";
        const bucketName = snapToValidBucket(rawBucket, taxonomy);
        const isGeneric = res.generic || !res.bucket_1.name || bucketName === "General Industry";
        const isDQ = res.disqualified;

        resultRows.push([
          analysisId, res.index, originalValue,
          JSON.stringify(row),
          bucketName, bucketName, res.bucket_3.name || null, res.bucket_2.name || null,
          res.bucket_1.score || null, res.bucket_1.reason || null,
          isGeneric, isDQ, costPerRow,
        ]);
      }
    }
  }

  return { rows: resultRows, tokenUsage, totalCost };
}

function estimateBatchCost(
  tokens: { promptTokens: number; completionTokens: number },
  provider: string,
  model: string | null
): number {
  // Approximate pricing per 1M tokens
  let inputRate = 0.15, outputRate = 0.60; // defaults (gemini flash)

  if (provider === "openai") {
    if (model?.includes("5.4")) { inputRate = 2.50; outputRate = 10.00; }
    else if (model?.includes("5") && model?.includes("mini")) { inputRate = 0.30; outputRate = 1.25; }
    else if (model?.includes("5") && model?.includes("nano")) { inputRate = 0.10; outputRate = 0.40; }
    else if (model?.includes("4.1") && model?.includes("mini")) { inputRate = 0.40; outputRate = 1.60; }
    else if (model?.includes("4.1") && model?.includes("nano")) { inputRate = 0.10; outputRate = 0.40; }
    else if (model?.includes("4o-mini")) { inputRate = 0.15; outputRate = 0.60; }
    else if (model?.includes("4o")) { inputRate = 2.50; outputRate = 10.00; }
    else { inputRate = 2.00; outputRate = 8.00; }
  } else if (provider === "claude") {
    if (model?.includes("opus")) { inputRate = 15.00; outputRate = 75.00; }
    else if (model?.includes("haiku")) { inputRate = 0.80; outputRate = 4.00; }
    else { inputRate = 3.00; outputRate = 15.00; }
  } else if (provider === "gemini") {
    if (model?.includes("pro")) { inputRate = 1.25; outputRate = 10.00; }
    else if (model?.includes("flash-lite")) { inputRate = 0.02; outputRate = 0.10; }
    else { inputRate = 0.15; outputRate = 0.60; }
  } else if (provider === "openrouter") {
    inputRate = 0; outputRate = 0; // Default to free for OpenRouter
  }

  return (tokens.promptTokens * inputRate + tokens.completionTokens * outputRate) / 1_000_000;
}
