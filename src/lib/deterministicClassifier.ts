/**
 * Deterministic Classifier — Pure JS keyword matching engine
 *
 * Uses the taxonomy's include/exclude terms to classify values
 * without any AI API calls. Instant and free.
 *
 * Now examines ALL columns in a row for maximum signal,
 * not just the selected column.
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
 * Classify a batch of rows deterministically using keyword matching.
 * Each item contains the full row data for multi-column matching.
 */
export function classifyDeterministic(
  batch: { index: number; value: string; allColumns?: Record<string, string> }[],
  taxonomy: BucketDefinition[]
): DeterministicResult[] {
  return batch.map((item) => classifyOne(item.index, item.value, item.allColumns || {}, taxonomy));
}

function classifyOne(
  index: number,
  primaryValue: string,
  allColumns: Record<string, string>,
  taxonomy: BucketDefinition[]
): DeterministicResult {
  const primaryLower = primaryValue.toLowerCase().trim();

  if (!primaryLower) {
    return {
      index,
      value: primaryValue,
      bucket: "General Industry",
      confidence: 0,
      method: "needs_ai",
      reason: "Empty value",
    };
  }

  // Build a combined search string from ALL columns for broader matching
  const allValuesArr = Object.values(allColumns).filter(Boolean);
  const combinedLower = allValuesArr.map((v) => v.toLowerCase().trim()).join(" | ");
  // Primary value gets priority; combined gives additional signals
  const searchStrings = [primaryLower, combinedLower].filter(Boolean);

  const scores: { bucket: BucketDefinition; score: number; matchedTerms: string[] }[] = [];

  for (const bucket of taxonomy) {
    if (bucket.bucket_name === "General Industry") continue;

    let score = 0;
    const matchedTerms: string[] = [];
    let excluded = false;

    // Check exclude terms on primary value
    for (const term of bucket.exclude) {
      if (primaryLower.includes(term.toLowerCase())) {
        excluded = true;
        break;
      }
    }

    if (excluded) continue;

    // Score include terms — check primary first (higher weight), then all columns
    for (const term of bucket.include) {
      const termLower = term.toLowerCase();

      // Primary value match (higher weight)
      if (primaryLower.includes(termLower)) {
        const wordCount = Math.max(1, termLower.split(" ").length);
        const exactBonus = primaryLower === termLower ? 5 : 0;
        score += wordCount * 2 + exactBonus; // Double weight for primary column
        matchedTerms.push(term);
      }
      // Secondary match in other columns (lower weight)
      else if (combinedLower.includes(termLower)) {
        const wordCount = Math.max(1, termLower.split(" ").length);
        score += wordCount; // Single weight for secondary columns
        matchedTerms.push(`~${term}`);
      }
    }

    // Check example_strings
    for (const example of bucket.example_strings) {
      const exLower = example.toLowerCase();
      
      if (primaryLower.includes(exLower) || exLower.includes(primaryLower)) {
        score += 4; // Strong match
        matchedTerms.push(`≈${example.substring(0, 30)}`);
      } else if (combinedLower.includes(exLower) || exLower.includes(combinedLower.substring(0, 80))) {
        score += 1;
        matchedTerms.push(`~≈${example.substring(0, 25)}`);
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
      reason: "No keyword matches found",
    };
  }

  const top = scores[0];
  const maxPossibleScore = top.bucket.include.length * 4 + top.bucket.example_strings.length * 4;
  const normalizedConfidence = Math.min(1, top.score / Math.max(maxPossibleScore, 6));

  // Check for conflict: if second-best score is within 15% of top
  if (scores.length >= 2) {
    const second = scores[1];
    const ratio = second.score / top.score;
    if (ratio >= 0.85) {
      return {
        index,
        value: primaryValue,
        bucket: top.bucket.bucket_name,
        confidence: normalizedConfidence * 0.5,
        method: "needs_ai",
        reason: `Ambiguous: "${top.bucket.bucket_name}" vs "${second.bucket.bucket_name}"`,
      };
    }
  }

  // Confident classification — lowered threshold from 0.4 to 0.2 for broader acceptance
  if (normalizedConfidence >= 0.2) {
    return {
      index,
      value: primaryValue,
      bucket: top.bucket.bucket_name,
      confidence: normalizedConfidence,
      method: "deterministic",
      reason: `Matched: ${top.matchedTerms.slice(0, 4).join(", ")}`,
    };
  }

  // Low confidence — needs AI review
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
