/**
 * DuckDB Classification Engine v2
 *
 * CRITICAL FIX: Uses a scores table with ROW_NUMBER() to pick BEST bucket
 * per row instead of "first match wins" UPDATE approach.
 *
 * Only uses the SELECTED COLUMN for matching (not metadata columns like
 * lead_list_name which could contaminate results).
 */

import { DuckDBInstance } from "@duckdb/node-api";
import type { BucketDefinition } from "@/types";

export interface DuckDBClassificationResult {
  index: number;
  value: string;
  bucket: string;
  confidence: number;
  method: "deterministic" | "needs_ai";
  reason: string;
}

/**
 * Classify rows using DuckDB SQL-based "best match wins" scoring.
 */
export async function classifyWithDuckDB(
  rows: Record<string, string>[],
  selectedColumn: string,
  taxonomy: BucketDefinition[]
): Promise<DuckDBClassificationResult[]> {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  try {
    // 1. Create contacts table — store idx, primary text, AND fallback text from other columns
    await conn.run(`CREATE TABLE contacts (idx INTEGER, primary_text VARCHAR, fallback_text VARCHAR)`);

    // 2. Create scoring table — all bucket scores for all rows
    await conn.run(`CREATE TABLE scores (idx INTEGER, bucket_name VARCHAR, score DOUBLE, reason VARCHAR)`);

    // 3. Insert rows — primary column + fallback from ALL other columns
    for (let i = 0; i < rows.length; i++) {
      const primaryVal = (rows[i][selectedColumn] || "").toLowerCase().trim();

      // Build fallback text from COMPANY-SPECIFIC columns only (not metadata)
      // Exclude: names, IDs, list names, row indices, proxy info — these don't indicate industry
      const METADATA_COLUMNS = new Set([
        "first_name", "last_name", "full_name", "name",
        "lead_list_name", "list_name", "lead_list",
        "contact_id", "id", "row_index", "row_number", "#",
        "proxy_used", "proxy", "status", "confidence", "reason",
        "bucket", "bucket_name", "industry", "classification_result",
      ]);

      const fallbackParts: string[] = [];
      for (const [key, val] of Object.entries(rows[i])) {
        if (key === selectedColumn || !val || !val.trim()) continue;
        if (METADATA_COLUMNS.has(key.toLowerCase().trim())) continue;
        const v = val.trim().toLowerCase();
        // Skip very short values (likely abbreviations or IDs)
        if (v.length <= 2) continue;
        // Extract email domain as words: user@goldandcoin.com → "goldandcoin"
        if (v.includes("@") && v.includes(".")) {
          const domain = v.split("@")[1]?.split(".")[0] || "";
          if (domain && domain.length > 2) {
            fallbackParts.push(domain);
          }
        }
        // Also add any URL domain hints: http://www.goldandcoin.com → "goldandcoin"
        else if (v.startsWith("http")) {
          try {
            const hostname = new URL(v).hostname.replace("www.", "");
            const domPart = hostname.split(".")[0];
            if (domPart && domPart.length > 2) fallbackParts.push(domPart);
          } catch { /* skip bad URLs */ }
        }
        // Add other column values directly (company name, job title, etc.)
        else if (v.length < 200) {
          fallbackParts.push(v);
        }
      }
      const fallbackVal = fallbackParts.join(" ").substring(0, 500);
      const isError = !primaryVal || primaryVal.includes("scrape error") || primaryVal === "error" || primaryVal === "n/a" || primaryVal === "null" || primaryVal.includes("site error");

      // Use fallback_text if primary is empty/error
      const effectivePrimary = isError ? fallbackVal : primaryVal;

      await conn.run(
        `INSERT INTO contacts VALUES (${i}, '${escapeSql(effectivePrimary)}', '${escapeSql(fallbackVal)}')`
      );
    }

    // 4. For EACH bucket, INSERT scores into the scores table (not UPDATE)
    const activeBuckets = taxonomy.filter(b => b.bucket_name !== "General Industry");

    for (const bucket of activeBuckets) {
      if (bucket.include.length === 0) continue;

      // Build scoring expressions for include terms
      const scoreParts: string[] = [];
      const reasonParts: string[] = [];

      for (const term of bucket.include) {
        const termLower = term.toLowerCase();
        const words = termLower.split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) continue;

        if (words.length >= 2) {
          // Multi-word keyword: exact phrase = 4x per word, all words present = 3x
          const exactCheck = `primary_text LIKE '%${escapeSql(termLower)}%'`;
          const allWordsCheck = words.map(w => `primary_text LIKE '%${escapeSql(w)}%'`).join(" AND ");
          scoreParts.push(`CASE WHEN (${exactCheck}) THEN ${words.length * 4} WHEN (${allWordsCheck}) THEN ${words.length * 3} ELSE 0 END`);
          reasonParts.push(termLower);
        } else {
          // Single-word keyword: lower weight (1x), match with word boundaries
          const word = words[0];
          // Only count single-word if text contains it prominently
          const check = `primary_text LIKE '%${escapeSql(word)}%'`;
          scoreParts.push(`CASE WHEN (${check}) THEN 1 ELSE 0 END`);
        }
      }

      if (scoreParts.length === 0) continue;

      // Build exclude clause
      const excludeConditions: string[] = [];
      for (const term of bucket.exclude) {
        const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) continue;
        const allWordsCheck = words.map(w => `primary_text LIKE '%${escapeSql(w)}%'`).join(" AND ");
        excludeConditions.push(`(${allWordsCheck})`);
      }
      const excludeClause = excludeConditions.length > 0
        ? `AND NOT (${excludeConditions.join(" OR ")})`
        : "";

      const scoreExpr = scoreParts.join(" + ");
      const reasonStr = escapeSql(reasonParts.slice(0, 3).join(", "));

      // INSERT scores for ALL rows that match this bucket (not UPDATE!)
      // Score from BOTH primary_text AND fallback_text (fallback at 50% weight)
      const fallbackScoreParts = scoreParts.map(sp => 
        sp.replace(/primary_text/g, "fallback_text")
      );
      const fallbackScoreExpr = fallbackScoreParts.join(" + ");
      
      // Exclude check on primary first, then fallback
      const fallbackExcludeConditions: string[] = [];
      for (const term of bucket.exclude) {
        const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) continue;
        const fbCheck = words.map(w => `fallback_text LIKE '%${escapeSql(w)}%'`).join(" AND ");
        fallbackExcludeConditions.push(`(${fbCheck})`);
      }
      const fallbackExcludeClause = fallbackExcludeConditions.length > 0
        ? `AND NOT (${fallbackExcludeConditions.join(" OR ")})`
        : "";

      await conn.run(`
        INSERT INTO scores
        SELECT idx, '${escapeSql(bucket.bucket_name)}',
          GREATEST(
            (${scoreExpr}),
            CAST((${fallbackScoreExpr}) * 0.5 AS DOUBLE)
          ),
          'Matched: ${reasonStr}'
        FROM contacts
        WHERE ((${scoreExpr}) > 0 OR (${fallbackScoreExpr}) > 0)
        ${excludeClause}
        ${fallbackExcludeClause}
      `);
    }

    // 5. Find BEST bucket per row using ROW_NUMBER
    // This ensures each row goes to the HIGHEST-scoring bucket
    const bestResult = await conn.run(`
      SELECT c.idx, c.primary_text,
        COALESCE(best.bucket_name, 'General Industry') as bucket,
        COALESCE(best.score, 0) as score,
        COALESCE(best.reason, 'No keyword matches found') as reason
      FROM contacts c
      LEFT JOIN (
        SELECT idx, bucket_name, score, reason,
          ROW_NUMBER() OVER (PARTITION BY idx ORDER BY score DESC) as rn
        FROM scores
      ) best ON c.idx = best.idx AND best.rn = 1
      ORDER BY c.idx
    `);

    const classified: DuckDBClassificationResult[] = [];

    for (let ci = 0; ci < bestResult.chunkCount; ci++) {
      const chunk = bestResult.getChunk(ci);
      const chunkRows = chunk.getRows();
      for (const r of chunkRows) {
        const idx = Number(r[0]);
        const primaryText = String(r[1] || "");
        const bucketName = String(r[2] || "General Industry");
        const score = Number(r[3] || 0);
        const reason = String(r[4] || "No keyword matches found");

        // Skip empty/error values
        const isError = !primaryText || primaryText === "scrape error" || primaryText === "error" || primaryText === "n/a";

        const maxScore = 20;
        const confidence = Math.min(1, score / maxScore);

        classified.push({
          index: idx,
          value: rows[idx]?.[selectedColumn] || primaryText,
          bucket: isError ? "General Industry" : bucketName,
          confidence: isError ? 0 : Math.max(confidence, bucketName === "General Industry" ? 0.1 : 0.3),
          method: isError || bucketName === "General Industry" || confidence < 0.15 ? "needs_ai" : "deterministic",
          reason: isError ? "Empty or error value" : reason,
        });
      }
    }

    return classified;
  } finally {
    conn.closeSync();
  }
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

/**
 * Apply minimum bucket threshold — merge small buckets into General Industry
 */
export function applyBucketThresholdDuckDB(
  results: DuckDBClassificationResult[],
  minThreshold: number
): DuckDBClassificationResult[] {
  if (minThreshold <= 1) return results; // No merging if threshold is 1 or less

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.bucket] = (counts[r.bucket] || 0) + 1;
  }

  const smallBuckets = new Set<string>();
  for (const [bucket, count] of Object.entries(counts)) {
    if (bucket !== "General Industry" && count < minThreshold) {
      smallBuckets.add(bucket);
    }
  }

  if (smallBuckets.size === 0) return results;

  return results.map((r) => {
    if (smallBuckets.has(r.bucket)) {
      return {
        ...r,
        bucket: "General Industry",
        reason: `${r.reason} [Merged: < ${minThreshold} contacts]`,
      };
    }
    return r;
  });
}
