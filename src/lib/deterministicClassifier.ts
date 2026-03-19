/**
 * Deterministic Classifier — Pure JS keyword matching engine
 *
 * Uses the taxonomy's include/exclude terms to classify values
 * without any AI API calls. Instant and free.
 *
 * Conflict resolution: weighted scoring based on term specificity.
 * If top-2 bucket scores are within 10%, mark as needs_ai.
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
 * Classify a batch of values deterministically using keyword matching
 */
export function classifyDeterministic(
  batch: { index: number; value: string }[],
  taxonomy: BucketDefinition[]
): DeterministicResult[] {
  return batch.map((item) => classifyOne(item.index, item.value, taxonomy));
}

function classifyOne(
  index: number,
  value: string,
  taxonomy: BucketDefinition[]
): DeterministicResult {
  const lower = value.toLowerCase().trim();

  if (!lower) {
    return {
      index,
      value,
      bucket: "General Industry",
      confidence: 0,
      method: "needs_ai",
      reason: "Empty value",
    };
  }

  const scores: { bucket: BucketDefinition; score: number; matchedTerms: string[] }[] = [];

  for (const bucket of taxonomy) {
    if (bucket.bucket_name === "General Industry") continue;

    let score = 0;
    const matchedTerms: string[] = [];
    let excluded = false;

    // Check exclude terms first
    for (const term of bucket.exclude) {
      if (lower.includes(term.toLowerCase())) {
        excluded = true;
        break;
      }
    }

    if (excluded) continue;

    // Score include terms with specificity weighting
    for (const term of bucket.include) {
      const termLower = term.toLowerCase();
      if (lower.includes(termLower)) {
        // Weight by term length (longer = more specific)
        const weight = Math.max(1, termLower.split(" ").length);
        // Bonus for exact phrase match
        const exactBonus = lower === termLower ? 3 : 0;
        score += weight + exactBonus;
        matchedTerms.push(term);
      }
    }

    // Check example_strings for additional scoring
    for (const example of bucket.example_strings) {
      const exLower = example.toLowerCase();
      // Check if the value is very similar to an example
      if (lower.includes(exLower) || exLower.includes(lower)) {
        score += 2;
        matchedTerms.push(`~${example.substring(0, 30)}`);
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
      value,
      bucket: "General Industry",
      confidence: 0.1,
      method: "needs_ai",
      reason: "No keyword matches found",
    };
  }

  const top = scores[0];
  const maxPossibleScore = top.bucket.include.length * 2 + top.bucket.example_strings.length * 2;
  const normalizedConfidence = Math.min(1, top.score / Math.max(maxPossibleScore, 4));

  // Check for conflict: if second-best score is within 10% of top
  if (scores.length >= 2) {
    const second = scores[1];
    const ratio = second.score / top.score;
    if (ratio >= 0.9) {
      return {
        index,
        value,
        bucket: top.bucket.bucket_name,
        confidence: normalizedConfidence * 0.5, // Lower confidence due to ambiguity
        method: "needs_ai",
        reason: `Ambiguous: "${top.bucket.bucket_name}" (${top.score.toFixed(1)}) vs "${second.bucket.bucket_name}" (${second.score.toFixed(1)})`,
      };
    }
  }

  // Confident classification
  if (normalizedConfidence >= 0.4) {
    return {
      index,
      value,
      bucket: top.bucket.bucket_name,
      confidence: normalizedConfidence,
      method: "deterministic",
      reason: `Matched: ${top.matchedTerms.join(", ")}`,
    };
  }

  // Low confidence — needs AI review
  return {
    index,
    value,
    bucket: top.bucket.bucket_name,
    confidence: normalizedConfidence,
    method: "needs_ai",
    reason: `Low confidence match: ${top.matchedTerms.join(", ")}`,
  };
}

/**
 * Apply minimum bucket threshold — merge small buckets into General Industry
 */
export function applyBucketThreshold(
  results: DeterministicResult[],
  minThreshold: number
): DeterministicResult[] {
  // Count contacts per bucket
  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.bucket] = (counts[r.bucket] || 0) + 1;
  }

  // Identify buckets below threshold
  const smallBuckets = new Set<string>();
  for (const [bucket, count] of Object.entries(counts)) {
    if (bucket !== "General Industry" && count < minThreshold) {
      smallBuckets.add(bucket);
    }
  }

  if (smallBuckets.size === 0) return results;

  // Reassign small bucket contacts to General Industry
  return results.map((r) => {
    if (smallBuckets.has(r.bucket)) {
      return {
        ...r,
        bucket: "General Industry",
        reason: `${r.reason} [Merged: bucket had < ${minThreshold} contacts]`,
      };
    }
    return r;
  });
}
