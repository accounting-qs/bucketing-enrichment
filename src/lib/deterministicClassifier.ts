/**
 * Deterministic Classifier — Word-level keyword matching engine
 *
 * Uses tokenized word matching instead of substring matching.
 * "wealth management" → checks that BOTH "wealth" AND "management" appear in text.
 * This handles cases like "Wealth and Asset Management" correctly.
 *
 * Examines ALL columns in a row for maximum signal.
 */

import type { BucketDefinition } from "@/types";

export interface DeterministicResult {
  index: number;
  value: string;
  bucket: string;
  confidence: number;
  method: "deterministic" | "needs_ai";
  reason: string;
}

/**
 * Check if ALL words from a keyword phrase appear in the text.
 * More flexible than includes() — handles "wealth AND asset management".
 */
function allWordsPresent(text: string, keyword: string): boolean {
  const words = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  return words.length > 0 && words.every(w => text.includes(w));
}

/**
 * Check if the exact phrase appears (substring match).
 * Gives a higher score bonus when true.
 */
function exactPhrasePresent(text: string, keyword: string): boolean {
  return text.includes(keyword.toLowerCase());
}

/**
 * Classify a batch of rows deterministically using word-level keyword matching.
 */
export function classifyDeterministic(
  batch: { index: number; value: string; allColumns?: Record<string, string> }[],
  taxonomy: BucketDefinition[]
): DeterministicResult[] {
  return batch.map((item) => classifyOne(item.index, item.value, item.allColumns || {}, taxonomy));
}

function isErrorValue(val: unknown): boolean {
  const v = String(val ?? "").toLowerCase().trim();
  if (!v || v === "null" || v === "n/a" || v === "na" || v === "error") return true;
  // Scraper error patterns
  if (v.includes("scrape error") || v.includes("site error") || v.includes("crawl error")) return true;
  // Quoted variants: ""site error"", 'site error'
  const unquoted = v.replace(/^"|"$|^'|'$/g, "").trim();
  if (unquoted.includes("site error") || unquoted.includes("scrape error")) return true;
  return false;
}

function classifyOne(
  index: number,
  primaryValue: string,
  allColumns: Record<string, string>,
  taxonomy: BucketDefinition[]
): DeterministicResult {
  const primaryLower = String(primaryValue ?? "").toLowerCase().trim();

  if (!primaryLower || isErrorValue(primaryLower)) {
    return {
      index,
      value: primaryValue,
      bucket: "Error / Failed Enrichment",
      confidence: 0,
      method: "deterministic",
      reason: "Empty or error value",
    };
  }

  const scores: { bucket: BucketDefinition; score: number; matchedTerms: string[] }[] = [];

  // Fallback-only buckets are never scored — they are assigned explicitly
  const FALLBACK_BUCKETS = new Set(["General Industry", "Needs Manual Review", "Error / Failed Enrichment"]);

  for (const bucket of taxonomy) {
    if (FALLBACK_BUCKETS.has(bucket.bucket_name)) continue;

    let score = 0;
    const matchedTerms: string[] = [];
    let excluded = false;

    // Check exclude terms
    for (const term of bucket.exclude) {
      if (allWordsPresent(primaryLower, term)) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;

    // Score include terms with word-level matching — PRIMARY column ONLY
    for (const term of bucket.include) {
      if (term == null) continue; // guard against null entries from DB
      const termLower = String(term).toLowerCase();
      const wordCount = Math.max(1, termLower.split(/\s+/).length);

      // Primary value — exact phrase match (highest weight)
      if (exactPhrasePresent(primaryLower, termLower)) {
        score += wordCount >= 2 ? wordCount * 4 : 2; // Multi-word exact = 4x, single-word = 2x
        matchedTerms.push(`✓ "${term}"`);
      }
      // Primary value — all words present (high weight, multi-word only)
      else if (wordCount >= 2 && allWordsPresent(primaryLower, termLower)) {
        score += wordCount * 3; // All words present = 3x per word
        matchedTerms.push(`≈ "${term}"`);
      }
      // Single-word keyword — low weight, only if prominent
      else if (wordCount === 1 && primaryLower.includes(termLower)) {
        score += 1; // Single word = 1x
        matchedTerms.push(`~ "${term}"`);
      }
    }

    // Check example_strings for similarity
    for (const example of bucket.example_strings) {
      if (example == null) continue; // guard against null entries from DB
      const exLower = String(example).toLowerCase();

      // Check if most words from example are in primary
      const exWords = exLower.split(/\s+/).filter(w => w.length > 2);
      const matchCount = exWords.filter(w => primaryLower.includes(w)).length;
      const matchRatio = exWords.length > 0 ? matchCount / exWords.length : 0;

      if (matchRatio >= 0.6) {
        score += Math.round(matchRatio * 4);
        matchedTerms.push(`ex:"${example.substring(0, 25)}…"`);
      }
    }

    // Single important word matches (catch individual words like "accounting", "bank", "manufacturing")
    const singleWordTerms = bucket.include.filter(t => t != null && !String(t).includes(" "));
    for (const term of singleWordTerms) {
      // Already scored above, but check if primary starts with or prominently features the word
      const tl = String(term).toLowerCase();
      if (primaryLower.startsWith(tl) || primaryLower.includes(` ${tl} `)) {
        score += 1; // Small bonus for prominent single-word match
      }
    }

    if (score > 0) {
      scores.push({ bucket, score, matchedTerms });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return {
      index,
      value: primaryValue,
      bucket: "General Industry",
      confidence: 0.1,
      method: "needs_ai",
      reason: "No keyword matches found — needs AI or manual review",
    };
  }

  const top = scores[0];
  // Normalize confidence: each include term can contribute up to 4 points per word
  const maxPossible = top.bucket.include.reduce((sum, t) => sum + Math.max(1, t.split(/\s+/).length) * 4, 0) + top.bucket.example_strings.length * 4;
  const normalizedConfidence = Math.min(1, top.score / Math.max(maxPossible, 8));

  // Check for ambiguity: if second-best score is within 20% of top
  if (scores.length >= 2) {
    const second = scores[1];
    const ratio = second.score / top.score;
    if (ratio >= 0.8) {
      return {
        index,
        value: primaryValue,
        bucket: top.bucket.bucket_name,
        confidence: normalizedConfidence * 0.5,
        method: "needs_ai",
        reason: `Ambiguous: "${top.bucket.bucket_name}" (${top.score}) vs "${second.bucket.bucket_name}" (${second.score})`,
      };
    }
  }

  // Score >= 3 means at least one meaningful keyword matched
  if (top.score >= 3) {
    return {
      index,
      value: primaryValue,
      bucket: top.bucket.bucket_name,
      confidence: Math.max(normalizedConfidence, 0.3),
      method: "deterministic",
      reason: `Matched: ${top.matchedTerms.slice(0, 3).join(", ")}`,
    };
  }

  // Low score — needs AI review
  return {
    index,
    value: primaryValue,
    bucket: top.bucket.bucket_name,
    confidence: normalizedConfidence,
    method: "needs_ai",
    reason: `Low confidence: ${top.matchedTerms.slice(0, 3).join(", ")}`,
  };
}

/**
 * Apply minimum bucket threshold — merge small buckets into General Industry
 */
export function applyBucketThreshold(
  results: DeterministicResult[],
  minThreshold: number
): DeterministicResult[] {
  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.bucket] = (counts[r.bucket] || 0) + 1;
  }

  const MERGE_EXEMPT = new Set(["General Industry", "Needs Manual Review", "Error / Failed Enrichment"]);
  const smallBuckets = new Set<string>();
  for (const [bucket, count] of Object.entries(counts)) {
    if (!MERGE_EXEMPT.has(bucket) && count < minThreshold) {
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
