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
 * Detect scraper error values that should always → General Industry.
 * Never attempt fallback classification for these.
 */
function isErrorValue(val: string): boolean {
  const v = (val || "").toLowerCase().trim();
  if (!v || v === "null" || v === "n/a" || v === "na" || v === "error") return true;
  if (v.includes("scrape error") || v.includes("site error") || v.includes("crawl error")) return true;
  // Handle quoted variants like ""site error""
  const unquoted = v.replace(/^"|"$|^'|'$/g, "").trim();
  if (unquoted.includes("site error") || unquoted.includes("scrape error")) return true;
  return false;
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
        const valStr = String(val ?? "");
        if (key === selectedColumn || !valStr || !valStr.trim()) continue;
        if (METADATA_COLUMNS.has(key.toLowerCase().trim())) continue;
        const v = valStr.trim().toLowerCase();
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
      const isError = isErrorValue(primaryVal);

      // IMPORTANT: Error values → empty string → score 0 on all buckets → General Industry
      // We do NOT fall back to website/email columns for error rows.
      const effectivePrimary = isError ? "" : primaryVal;

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

        // Always send error values to General Industry — never use their score
        const isError = isErrorValue(rows[idx]?.[selectedColumn] || "");

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

// ─────────────────────────────────────────────────────────────────────────────
// ENSEMBLE CLASSIFIER — Option B (voting) + Option A (multi-pass) + Option C
// ─────────────────────────────────────────────────────────────────────────────

type ScoringStrategy = "exact" | "fuzzy" | "fallback";

/** Metadata columns that carry no industry signal */
const METADATA_COLS = new Set([
  "first_name", "last_name", "full_name", "name",
  "lead_list_name", "list_name", "lead_list",
  "contact_id", "id", "row_index", "row_number", "#",
  "proxy_used", "proxy", "status", "confidence", "reason",
  "bucket", "bucket_name", "industry", "classification_result",
]);

/**
 * Build fallback text from non-selected columns.
 * 'domains_only' — website + email domains only (Strategy 3 / Option B)
 * 'all_columns'  — all non-metadata columns (rescue passes / Option C)
 */
function buildFallbackText(
  row: Record<string, string>,
  selectedColumn: string,
  mode: "domains_only" | "all_columns"
): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(row)) {
    const valStr = String(val ?? "");
    if (key === selectedColumn || !valStr?.trim()) continue;
    const k = key.toLowerCase().trim();
    const v = valStr.trim().toLowerCase();

    if (v.includes("@") && v.includes(".")) {
      const domain = v.split("@")[1]?.split(".")[0] || "";
      if (domain.length > 2) parts.push(domain);
    } else if (v.startsWith("http")) {
      try {
        const hostname = new URL(v).hostname.replace("www.", "");
        const domPart = hostname.split(".")[0];
        if (domPart && domPart.length > 2) parts.push(domPart);
      } catch { /* skip bad URLs */ }
    } else if (mode === "all_columns") {
      if (METADATA_COLS.has(k)) continue;
      if (v.length > 2 && v.length < 300) parts.push(v);
    }
  }
  return parts.join(" ").substring(0, 500);
}

/**
 * Build SQL score CASE WHEN expressions for a bucket and strategy.
 * Strategy 'exact': multi-word exact phrase only (no fuzzy, no single-word).
 * Strategy 'fuzzy'/'fallback': exact + all-words-present + single-word.
 */
function buildStrategySQLParts(
  bucket: BucketDefinition,
  strategy: ScoringStrategy
): { scoreParts: string[]; reasonTerms: string[] } | null {
  const col = strategy === "fallback" ? "fallback_text" : "primary_text";
  const scoreParts: string[] = [];
  const reasonTerms: string[] = [];

  for (const term of bucket.include) {
    const termLower = term.toLowerCase();
    const words = termLower.split(/\s+/).filter((w) => w.length > 1);
    if (words.length === 0) continue;

    if (words.length >= 2) {
      const exactCheck = `${col} LIKE '%${escapeSql(termLower)}%'`;
      if (strategy === "exact") {
        scoreParts.push(`CASE WHEN (${exactCheck}) THEN ${words.length * 4} ELSE 0 END`);
      } else {
        const allWords = words.map((w) => `${col} LIKE '%${escapeSql(w)}%'`).join(" AND ");
        scoreParts.push(
          `CASE WHEN (${exactCheck}) THEN ${words.length * 4} WHEN (${allWords}) THEN ${words.length * 3} ELSE 0 END`
        );
      }
      reasonTerms.push(termLower);
    } else if (strategy !== "exact") {
      // Single-word: only in fuzzy/fallback (too noisy for exact)
      const word = words[0];
      scoreParts.push(`CASE WHEN (${col} LIKE '%${escapeSql(word)}%') THEN 1 ELSE 0 END`);
    }
  }

  return scoreParts.length > 0 ? { scoreParts, reasonTerms } : null;
}

/** Build SQL exclude clause for a strategy's column */
function buildExcludeClause(bucket: BucketDefinition, strategy: ScoringStrategy): string {
  const col = strategy === "fallback" ? "fallback_text" : "primary_text";
  const conditions: string[] = [];
  for (const term of bucket.exclude) {
    const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (words.length === 0) continue;
    const check = words.map((w) => `${col} LIKE '%${escapeSql(w)}%'`).join(" AND ");
    conditions.push(`(${check})`);
  }
  return conditions.length > 0 ? `AND NOT (${conditions.join(" OR ")})` : "";
}

/**
 * Phase 1: Run 3 strategies in one DuckDB session and vote.
 * Returns a map of idx → result (with vote count stored in reason prefix).
 */
async function runEnsemblePhase(
  rows: Record<string, string>[],
  indices: number[],
  selectedColumn: string,
  taxonomy: BucketDefinition[]
): Promise<Map<number, DuckDBClassificationResult & { votes: number }>> {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  try {
    await conn.run(`CREATE TABLE contacts (idx INTEGER, primary_text VARCHAR, fallback_text VARCHAR)`);
    await conn.run(`CREATE TABLE scores_s1 (idx INTEGER, bucket_name VARCHAR, score DOUBLE, reason VARCHAR)`);
    await conn.run(`CREATE TABLE scores_s2 (idx INTEGER, bucket_name VARCHAR, score DOUBLE, reason VARCHAR)`);
    await conn.run(`CREATE TABLE scores_s3 (idx INTEGER, bucket_name VARCHAR, score DOUBLE, reason VARCHAR)`);

    // Insert rows
    for (const i of indices) {
      const primary = (rows[i][selectedColumn] || "").toLowerCase().trim();
      const fallback = buildFallbackText(rows[i], selectedColumn, "domains_only");
      await conn.run(
        `INSERT INTO contacts VALUES (${i}, '${escapeSql(primary)}', '${escapeSql(fallback)}')`
      );
    }

    const activeBuckets = taxonomy.filter(
      (b) => b.bucket_name !== "General Industry" && b.include.length > 0
    );

    const strategyConfig: Array<[ScoringStrategy, string]> = [
      ["exact", "scores_s1"],
      ["fuzzy", "scores_s2"],
      ["fallback", "scores_s3"],
    ];

    for (const bucket of activeBuckets) {
      for (const [strategy, tableName] of strategyConfig) {
        const parts = buildStrategySQLParts(bucket, strategy);
        if (!parts) continue;
        const scoreExpr = parts.scoreParts.join(" + ");
        const excl = buildExcludeClause(bucket, strategy);
        const reason = escapeSql(parts.reasonTerms.slice(0, 3).join(", "));
        await conn.run(`
          INSERT INTO ${tableName}
          SELECT idx, '${escapeSql(bucket.bucket_name)}', (${scoreExpr}), 'Matched: ${reason}'
          FROM contacts
          WHERE (${scoreExpr}) > 0
          ${excl}
        `);
      }
    }

    // Vote: exact needs score >= 6, fuzzy/fallback need >= 3
    const voteResult = await conn.run(`
      WITH
      best_s1 AS (
        SELECT idx, bucket_name, score, reason,
          ROW_NUMBER() OVER (PARTITION BY idx ORDER BY score DESC) as rn
        FROM scores_s1 WHERE score >= 6
      ),
      best_s2 AS (
        SELECT idx, bucket_name, score, reason,
          ROW_NUMBER() OVER (PARTITION BY idx ORDER BY score DESC) as rn
        FROM scores_s2 WHERE score >= 3
      ),
      best_s3 AS (
        SELECT idx, bucket_name, score, reason,
          ROW_NUMBER() OVER (PARTITION BY idx ORDER BY score DESC) as rn
        FROM scores_s3 WHERE score >= 3
      ),
      all_votes AS (
        SELECT idx, bucket_name, score, reason FROM best_s1 WHERE rn = 1
        UNION ALL
        SELECT idx, bucket_name, score, reason FROM best_s2 WHERE rn = 1
        UNION ALL
        SELECT idx, bucket_name, score, reason FROM best_s3 WHERE rn = 1
      ),
      vote_counts AS (
        SELECT idx, bucket_name,
          COUNT(*) as votes,
          MAX(score) as max_score,
          MAX(reason) as best_reason
        FROM all_votes
        GROUP BY idx, bucket_name
      ),
      winner AS (
        SELECT idx, bucket_name, votes, max_score, best_reason,
          ROW_NUMBER() OVER (PARTITION BY idx ORDER BY votes DESC, max_score DESC) as rn
        FROM vote_counts
      )
      SELECT c.idx,
        COALESCE(w.bucket_name, 'General Industry') as bucket,
        COALESCE(w.votes, 0) as votes,
        COALESCE(w.max_score, 0) as score,
        COALESCE(w.best_reason, 'No keyword matches found') as reason
      FROM contacts c
      LEFT JOIN winner w ON c.idx = w.idx AND w.rn = 1
      ORDER BY c.idx
    `);

    const resultsMap = new Map<number, DuckDBClassificationResult & { votes: number }>();

    for (let ci = 0; ci < voteResult.chunkCount; ci++) {
      const chunk = voteResult.getChunk(ci);
      for (const r of chunk.getRows()) {
        const idx = Number(r[0]);
        const bucket = String(r[1] || "General Industry");
        const votes = Number(r[2] || 0);
        const score = Number(r[3] || 0);
        const reason = String(r[4] || "No keyword matches found");

        let confidence: number;
        let method: "deterministic" | "needs_ai";
        let label: string;

        if (votes >= 2) {
          confidence = Math.min(0.95, 0.65 + (score / 20) * 0.30);
          method = "deterministic";
          label = `[Consensus ${votes}/3]`;
        } else if (votes === 1) {
          confidence = Math.min(0.60, 0.35 + (score / 20) * 0.25);
          method = "needs_ai";
          label = "[Single strategy]";
        } else {
          confidence = 0.1;
          method = "needs_ai";
          label = "";
        }

        resultsMap.set(idx, {
          index: idx,
          value: rows[idx]?.[selectedColumn] || "",
          bucket,
          confidence,
          method,
          reason: label ? `${label} ${reason}` : reason,
          votes,
        });
      }
    }

    return resultsMap;
  } finally {
    conn.closeSync();
  }
}

/**
 * Rescue pass: runs on rows that got General Industry in the ensemble phase.
 * Uses combined text (primary + fallback) with a lower score threshold.
 * threshold=2 → Option A (rescue), threshold=1 → Option C (last-resort)
 */
async function runRescuePass(
  rows: Record<string, string>[],
  indices: number[],
  selectedColumn: string,
  taxonomy: BucketDefinition[],
  threshold: number
): Promise<Map<number, DuckDBClassificationResult>> {
  if (indices.length === 0) return new Map();

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();

  try {
    await conn.run(`CREATE TABLE contacts (idx INTEGER, combined_text VARCHAR)`);
    await conn.run(`CREATE TABLE scores (idx INTEGER, bucket_name VARCHAR, score DOUBLE, reason VARCHAR)`);

    // Use all columns for rescue (aggressive — last resort)
    for (const i of indices) {
      const primary = (rows[i][selectedColumn] || "").toLowerCase().trim();
      const fallback = buildFallbackText(rows[i], selectedColumn, "all_columns");
      const combined = `${primary} ${fallback}`.trim().substring(0, 600);
      await conn.run(`INSERT INTO contacts VALUES (${i}, '${escapeSql(combined)}')`);
    }

    const activeBuckets = taxonomy.filter(
      (b) => b.bucket_name !== "General Industry" && b.include.length > 0
    );

    for (const bucket of activeBuckets) {
      const scoreParts: string[] = [];
      const reasonTerms: string[] = [];
      const excludeConditions: string[] = [];

      for (const term of bucket.include) {
        const termLower = term.toLowerCase();
        const words = termLower.split(/\s+/).filter((w) => w.length > 1);
        if (words.length === 0) continue;

        if (words.length >= 2) {
          const exactCheck = `combined_text LIKE '%${escapeSql(termLower)}%'`;
          const allWords = words.map((w) => `combined_text LIKE '%${escapeSql(w)}%'`).join(" AND ");
          // Slightly lower weights to signal lower confidence for rescue results
          scoreParts.push(
            `CASE WHEN (${exactCheck}) THEN ${words.length * 3} WHEN (${allWords}) THEN ${words.length * 2} ELSE 0 END`
          );
          reasonTerms.push(termLower);
        } else {
          const word = words[0];
          scoreParts.push(`CASE WHEN (combined_text LIKE '%${escapeSql(word)}%') THEN 1 ELSE 0 END`);
        }
      }

      if (scoreParts.length === 0) continue;

      for (const term of bucket.exclude) {
        const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
        if (words.length === 0) continue;
        const check = words.map((w) => `combined_text LIKE '%${escapeSql(w)}%'`).join(" AND ");
        excludeConditions.push(`(${check})`);
      }

      const scoreExpr = scoreParts.join(" + ");
      const excl = excludeConditions.length > 0 ? `AND NOT (${excludeConditions.join(" OR ")})` : "";
      const reason = escapeSql(reasonTerms.slice(0, 3).join(", "));

      await conn.run(`
        INSERT INTO scores
        SELECT idx, '${escapeSql(bucket.bucket_name)}', (${scoreExpr}), 'Matched: ${reason}'
        FROM contacts
        WHERE (${scoreExpr}) >= ${threshold}
        ${excl}
      `);
    }

    const result = await conn.run(`
      SELECT c.idx,
        COALESCE(best.bucket_name, 'General Industry') as bucket,
        COALESCE(best.score, 0) as score,
        COALESCE(best.reason, 'No rescue match') as reason
      FROM contacts c
      LEFT JOIN (
        SELECT idx, bucket_name, score, reason,
          ROW_NUMBER() OVER (PARTITION BY idx ORDER BY score DESC) as rn
        FROM scores
      ) best ON c.idx = best.idx AND best.rn = 1
      ORDER BY c.idx
    `);

    const rescueMap = new Map<number, DuckDBClassificationResult>();
    const passLabel = threshold <= 1 ? "[Last-resort pass]" : "[Rescue pass]";
    const passConfidence = threshold <= 1 ? 0.20 : 0.35;

    for (let ci = 0; ci < result.chunkCount; ci++) {
      const chunk = result.getChunk(ci);
      for (const r of chunk.getRows()) {
        const idx = Number(r[0]);
        const bucket = String(r[1] || "General Industry");
        const reason = String(r[3] || "");

        if (bucket !== "General Industry") {
          rescueMap.set(idx, {
            index: idx,
            value: rows[idx]?.[selectedColumn] || "",
            bucket,
            confidence: passConfidence,
            method: "needs_ai",
            reason: `${passLabel} ${reason}`,
          });
        }
      }
    }

    return rescueMap;
  } finally {
    conn.closeSync();
  }
}

/**
 * Full 4-phase ensemble deterministic classifier.
 *
 * Phase 0 — Error pre-filter: null/Site Error/Scrape Error → General Industry immediately.
 * Phase 1 — 3-strategy vote: exact (S1), fuzzy (S2), fallback-columns (S3).
 *            2+ agree → high confidence deterministic.
 *            1 agrees → medium confidence, needs_ai flag.
 * Phase 2 — Rescue (Option A): rows with 0 votes re-run with combined text, threshold 2.
 * Phase 3 — Last-resort (Option C): still-General rows re-run with threshold 1.
 */
export async function classifyWithEnsemble(
  rows: Record<string, string>[],
  selectedColumn: string,
  taxonomy: BucketDefinition[]
): Promise<DuckDBClassificationResult[]> {
  // Phase 0: Pre-filter error values — instant General Industry
  const results: (DuckDBClassificationResult & { votes?: number })[] = new Array(rows.length);
  const rowsToClassify: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const primaryVal = (rows[i][selectedColumn] || "").toLowerCase().trim();
    if (isErrorValue(primaryVal)) {
      results[i] = {
        index: i,
        value: rows[i][selectedColumn] || "",
        bucket: "General Industry",
        confidence: 0,
        method: "deterministic",
        reason: "Error value → General Industry",
        votes: 0,
      };
    } else {
      rowsToClassify.push(i);
    }
  }

  if (rowsToClassify.length === 0) return results as DuckDBClassificationResult[];

  // Phase 1: 3-strategy ensemble with voting
  const phase1 = await runEnsemblePhase(rows, rowsToClassify, selectedColumn, taxonomy);

  // Rows that got 0 votes in the ensemble (no strategy had any signal)
  const noVoteIndices = rowsToClassify.filter((i) => (phase1.get(i)?.votes ?? 0) === 0);

  // Phase 2: Option A rescue — combined text, threshold = 2
  const rescue = await runRescuePass(rows, noVoteIndices, selectedColumn, taxonomy, 2);

  // Rows still going to General after rescue
  const stillGeneral = noVoteIndices.filter((i) => !rescue.has(i));

  // Phase 3: Option C last-resort — combined text, threshold = 1
  const lastResort = await runRescuePass(rows, stillGeneral, selectedColumn, taxonomy, 1);

  // Merge all results preserving priority: lastResort > rescue > phase1
  for (const i of rowsToClassify) {
    const p1 = phase1.get(i);
    const r = rescue.get(i);
    const lr = lastResort.get(i);

    results[i] = lr ?? r ?? p1 ?? {
      index: i,
      value: rows[i][selectedColumn] || "",
      bucket: "General Industry",
      confidence: 0.1,
      method: "needs_ai",
      reason: "No matches across all strategies",
    };
  }

  return results as DuckDBClassificationResult[];
}
