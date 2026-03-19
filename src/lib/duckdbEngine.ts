/**
 * DuckDB Classification Engine
 *
 * Uses DuckDB in-memory SQL for fast, accurate keyword matching.
 * Replaces the pure-JS classifier with SQL LIKE + word-level matching.
 *
 * Architecture:
 * 1. Load CSV rows into DuckDB in-memory table
 * 2. For each bucket, run SQL to check if ANY keyword's words appear in the text
 * 3. Score and rank matches
 * 4. Return classified results
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
 * Classify rows using DuckDB SQL-based matching.
 * Much faster and more accurate than pure JS for large datasets.
 */
export async function classifyWithDuckDB(
  rows: Record<string, string>[],
  selectedColumn: string,
  taxonomy: BucketDefinition[]
): Promise<DuckDBClassificationResult[]> {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  try {
    // 1. Create contacts table with all columns + an idx column
    const allKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    const columnDefs = allKeys.map((k, i) => `col_${i} VARCHAR`).join(", ");

    await conn.run(`CREATE TABLE contacts (idx INTEGER, combined_text VARCHAR, primary_text VARCHAR, ${columnDefs}, bucket VARCHAR, score DOUBLE, reason VARCHAR)`);

    // 2. Insert all rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const primaryVal = (row[selectedColumn] || "").trim();
      // Combine all column values for broader matching
      const combined = Object.values(row).filter(Boolean).join(" ").trim();

      const colValues = allKeys.map(k => escapeSql(row[k] || "")).join("', '");

      await conn.run(
        `INSERT INTO contacts VALUES (${i}, '${escapeSql(combined.toLowerCase())}', '${escapeSql(primaryVal.toLowerCase())}', '${colValues}', NULL, 0, NULL)`
      );
    }

    // 3. For each bucket, score rows using SQL word matching
    const activeBuckets = taxonomy.filter(b => b.bucket_name !== "General Industry");

    for (const bucket of activeBuckets) {
      if (bucket.include.length === 0) continue;

      // Build SQL conditions for include terms using word-level matching
      const includeConditions: string[] = [];
      for (const term of bucket.include) {
        const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) continue;

        // All words must be present in the text
        const wordChecks = words.map(w => `primary_text LIKE '%${escapeSql(w)}%'`).join(" AND ");
        const combinedChecks = words.map(w => `combined_text LIKE '%${escapeSql(w)}%'`).join(" AND ");

        // Primary match (higher score) or combined match (lower score)
        includeConditions.push(`CASE WHEN (${wordChecks}) THEN ${words.length * 3} WHEN (${combinedChecks}) THEN ${words.length} ELSE 0 END`);
      }

      // Build exclude conditions
      const excludeConditions: string[] = [];
      for (const term of bucket.exclude) {
        const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) continue;
        const wordChecks = words.map(w => `primary_text LIKE '%${escapeSql(w)}%'`).join(" AND ");
        excludeConditions.push(`(${wordChecks})`);
      }

      const excludeClause = excludeConditions.length > 0
        ? `AND NOT (${excludeConditions.join(" OR ")})`
        : "";

      // Calculate total score for this bucket
      const scoreExpr = includeConditions.join(" + ");

      // Update rows that have a HIGHER score for this bucket than their current score
      await conn.run(`
        UPDATE contacts
        SET bucket = '${escapeSql(bucket.bucket_name)}',
            score = (${scoreExpr}),
            reason = 'DuckDB match: ${escapeSql(bucket.include.slice(0, 3).join(", "))}'
        WHERE bucket IS NULL
          AND (${scoreExpr}) > 0
          AND (${scoreExpr}) >= score
          ${excludeClause}
      `);
    }

    // 4. Read results using chunk-based API
    const result = await conn.run("SELECT idx, primary_text, bucket, score FROM contacts ORDER BY idx");
    const classified: DuckDBClassificationResult[] = [];

    for (let ci = 0; ci < result.chunkCount; ci++) {
      const chunk = result.getChunk(ci);
      const chunkRows = chunk.getRows();
      for (const r of chunkRows) {
        const idx = Number(r[0]);
        const primaryText = String(r[1] || "");
        const bucketName = r[2] ? String(r[2]) : "General Industry";
        const score = Number(r[3] || 0);

        const maxScore = 30; // reasonable max for normalization
        const confidence = Math.min(1, score / maxScore);

        classified.push({
          index: idx,
          value: rows[idx]?.[selectedColumn] || primaryText,
          bucket: bucketName,
          confidence: Math.max(confidence, bucketName === "General Industry" ? 0.1 : 0.3),
          method: bucketName === "General Industry" || confidence < 0.2 ? "needs_ai" : "deterministic",
          reason: bucketName === "General Industry" ? "No keyword matches found" : `DuckDB score: ${score}`,
        });
      }
    }

    return classified;
  } finally {
    conn.closeSync();
  }
}

/**
 * Escape single quotes for SQL strings
 */
function escapeSql(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

/**
 * Apply minimum bucket threshold (reuses same logic, works on DuckDB results too)
 */
export function applyBucketThresholdDuckDB(
  results: DuckDBClassificationResult[],
  minThreshold: number
): DuckDBClassificationResult[] {
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
