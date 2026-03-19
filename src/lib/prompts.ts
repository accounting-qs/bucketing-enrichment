import type { BucketDefinition } from "@/types";

/**
 * System prompt backbone for AI classification
 * Based on the manager's PHASE 1B prompt for bucket matching
 */
export function buildClassificationSystemPrompt(
  taxonomy: BucketDefinition[]
): string {
  const bucketRefJson = JSON.stringify(
    taxonomy.map((b) => ({
      bucket_name: b.bucket_name,
      description: b.description,
      direct_ancestor: b.direct_ancestor,
      root_category: b.root_category,
      include: b.include,
      exclude: b.exclude,
      example_strings: b.example_strings,
    })),
    null,
    2
  );

  // Build explicit list of valid bucket names for the prompt
  const validBucketNames = taxonomy.map(b => b.bucket_name);
  const bucketNamesList = validBucketNames.map(n => `  - "${n}"`).join("\n");

  return `SYSTEM ROLE

You are matching company records to an existing industry taxonomy.
This output is used to measure bucket volumes and enable later roll-ups via ancestors.
This is NOT a creative writing task.

========================================
CRITICAL CONSTRAINT — VALID BUCKET NAMES
========================================

bucket_1.name MUST be one of these EXACT values (case-sensitive):
${bucketNamesList}

Do NOT invent new bucket names. Do NOT paraphrase or abbreviate.
If no bucket fits, use "General Industry".

========================================
NO SHORTCUTS
========================================

- You must base your decision ONLY on the input classification string and the bucket definitions provided.
- Do not guess what the company does beyond the text provided.
- Do not force-fit.
- If unclear, mark Generic (inviteable) rather than Disqualified.

========================================
INPUTS
========================================

(1) BUCKET_REFERENCE_JSON:
${bucketRefJson}

(2) COMPANY_CLASSIFICATIONS:
A batch of AI-enriched industry classification strings for multiple companies.
Each entry has an "index" and a "value".

========================================
ANCESTOR CHAIN RULES (CRITICAL)
========================================

You must output a fallback chain, not competing alternatives:

- bucket_1 MUST be a LEAF bucket from the bucket list.
- bucket_2 MUST be the direct_ancestor of bucket_1 (from the reference).
- bucket_3 MUST be the root_category of bucket_1 (if defined), otherwise blank.

Do NOT output unrelated narrow buckets as bucket_2 or bucket_3.
bucket_2 and bucket_3 are structural roll-ups.

========================================
ICP / DISQUALIFICATION
========================================

Disqualify ONLY if the classification clearly indicates:
- ecommerce / DTC physical product seller
- local services tied to geography
- brick-and-mortar retail
- low-ticket consumer business

If ambiguous, do NOT disqualify.
Prefer Generic.

========================================
SCORING (ALIGNMENT, NOT PROBABILITY)
========================================

Provide:
- bucket_1_score: 0.00–1.00 alignment with the leaf bucket
- bucket_2_score: must be <= bucket_1_score
- bucket_3_score: must be <= bucket_2_score

If no leaf bucket aligns at >= 0.55:
- leave bucket_1 empty and set generic=true (unless clearly disqualified)

========================================
OUTPUT REQUIREMENTS
========================================

Return ONLY valid JSON. The response must be a JSON array of objects, one per input record.
Each object must have this exact schema:

{
  "index": <number>,
  "bucket_1": {"name": "", "score": 0.0, "reason": ""},
  "bucket_2": {"name": "", "score": 0.0, "reason": ""},
  "bucket_3": {"name": "", "score": 0.0, "reason": ""},
  "generic": false,
  "disqualified": false
}

Reason constraints:
- Max 18 words each
- Must cite a phrase/concept from the COMPANY_CLASSIFICATION
- No repetition across reasons

Return ONLY the JSON array. No markdown, no explanation, no wrapping.`;
}

/**
 * Build the user message for a batch of values to classify
 */
export function buildBatchUserPrompt(
  batch: { index: number; value: string }[]
): string {
  return `Classify these ${batch.length} company records:

${JSON.stringify(batch, null, 2)}`;
}
