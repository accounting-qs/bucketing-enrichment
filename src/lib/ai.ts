import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

export interface TaxonomyNode {
  name: string;
  description?: string;
  children: TaxonomyNode[];
  isAiSuggested?: boolean;
}

export async function proposeTaxonomy(
  columnName: string,
  sampleValues: Array<{ value: string; count: number }>,
  providerInput: string,
  guide?: any[] | null
): Promise<TaxonomyNode[]> {
  const prompt = `
    You are a Strategic Data Architect. I have a dataset with a column named "${columnName}".
    I need you to propose a hierarchical TAXONOMY (Parent -> Child -> Leaf) to categorize this data.

    SAMPLE VALUES (Top 500):
    ${JSON.stringify(sampleValues.slice(0, 500))}

    TAXONOMY RULES:
    1. ${guide ? "CRITICAL STRICT RULE: You MUST ONLY use the exact taxonomy buckets provided in the GUIDE. DO NOT, under any circumstances, create, hallucinate, or suggest any new categories, sub-categories, or parent buckets." : "Create a logical hierarchy from scratch."}
    2. Focus on BROAD categories (e.g., "Finance") breaking down into specific niches (e.g., "Investment Banking").
    3. Propose a nested JSON structure.
    4. If using a guide, your output must exactly match the provided guide structure. Do not mark anything as aiSuggested.

    ${guide ? `USER GUIDE (JSON Schema): ${JSON.stringify(guide)}` : ""}

    OUTPUT FORMAT (JSON ARRAY):
    [
      {
        "name": "Parent Category",
        "description": "Optional description",
        "children": [
          { "name": "Sub-Category", "children": [] }
        ],
        "isAiSuggested": false
      }
    ]

    Return ONLY valid JSON.
  `;

  const commonSystem = "Return JSON only. No markdown. No text outside the array.";

  try {
    let provider = providerInput;
    let actualModel = "";
    if (providerInput.includes(':')) {
      [provider, actualModel] = providerInput.split(':');
    }

    const apiKey = getApiKey(provider);
    if (!apiKey) return [];

    let responseText = "";
    if (provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const res = await openai.chat.completions.create({
        model: actualModel || "gpt-4o",
        messages: [{ role: "system", content: commonSystem }, { role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      responseText = res.choices[0].message.content || "[]";
    } else if (provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        model: actualModel || "claude-3-7-sonnet-latest",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt + "\n\n" + commonSystem }],
      });
      responseText = res.content[0].type === 'text' ? res.content[0].text : '[]';
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: actualModel || "gemini-2.5-flash" });
      const res = await model.generateContent(prompt + "\n\n" + commonSystem);
      responseText = res.response.text();
    }

    const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleanJson);
    return Array.isArray(result) ? result : (result.buckets || []);
  } catch (err) {
    console.error(">>> PROPOSE TAXONOMY ERROR:", err);
    return [];
  }
}

export async function mapBatchToTaxonomy(
  columnName: string,
  batchValues: string[],
  parentBuckets: TaxonomyNode[],
  providerInput: string
): Promise<any> {
  // Simplify the tree for the prompt to save tokens, just sending names structure
  const simplifiedStructure = JSON.stringify(parentBuckets, (key, value) => {
    if (key === 'description' || key === 'isAiSuggested') return undefined;
    return value;
  });

  const prompt = `
    You are a Data Architect. Map the following batch of values from the column "${columnName}" to the predefined TAXONOMY.
    
    TAXONOMY STRUCTURE:
    ${simplifiedStructure}

    BATCH VALUES TO MAP:
    ${JSON.stringify(batchValues)}

    GOAL:
    1. CRITICAL: You MUST map EVERY single value in the "BATCH VALUES TO MAP" list.
    2. BE AGGRESSIVE: Do NOT use "General / Unformatted" unless the value is completely unreadable or nonsensical.
    3. BEST FIT: Even if a value doesn't match 100%, assign it to the Parent/Category that makes the most sense.
    4. SPECIFICITY: Assign to the deepest possible level (Leaf) of the taxonomy provided.
    5. STRICT RULES: DO NOT create, hallucinate, or invent ANY new buckets, child names, or paths. You MUST ONLY use paths that exist exactly in the TAXONOMY STRUCTURE. If a value absolutely does not fit anywhere, map it to the path ["General / Unformatted"].
    6. Return the full PATH as an array of strings (e.g., ["Real Estate", "Residential"]).

    OUTPUT FORMAT (JSON):
    {
      "mappings": [
        {
          "value": "Exact String from Batch",
          "path": ["Parent Name", "Child Name", "Leaf Name"]
        }
      ]
    }
  `;

  const commonSystem = "Return JSON only. No markdown.";

  try {
    let provider = providerInput;
    let actualModel = "";
    if (providerInput.includes(':')) {
      [provider, actualModel] = providerInput.split(':');
    }

    const apiKey = getApiKey(provider);
    if (!apiKey) return { mappings: [] };

    let responseText = "";
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const res = await openai.chat.completions.create({
        model: actualModel || "gpt-4o",
        messages: [{ role: "system", content: commonSystem }, { role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      responseText = res.choices[0].message.content || "{}";
      if (res.usage) {
          usage.promptTokens = res.usage.prompt_tokens;
          usage.completionTokens = res.usage.completion_tokens;
          usage.totalTokens = res.usage.total_tokens;
      }
    } else if (provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        model: actualModel || "claude-3-7-sonnet-latest",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt + "\n\n" + commonSystem }],
      });
      responseText = res.content[0].type === 'text' ? res.content[0].text : '{}';
      if (res.usage) {
          usage.promptTokens = res.usage.input_tokens;
          usage.completionTokens = res.usage.output_tokens;
          usage.totalTokens = res.usage.input_tokens + res.usage.output_tokens;
      }
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: actualModel || "gemini-2.5-flash" });
      const res = await model.generateContent(prompt + "\n\n" + commonSystem);
      responseText = res.response.text();
      if (res.response.usageMetadata) {
          usage.promptTokens = res.response.usageMetadata.promptTokenCount;
          usage.completionTokens = res.response.usageMetadata.candidatesTokenCount;
          usage.totalTokens = res.response.usageMetadata.totalTokenCount;
      }
    }

    const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleanJson);
    result.usage = usage;
    return result;
  } catch (err) {
    console.error(">>> BATCH MAPPING ERROR:", err);
    throw err;
  }
}

function getApiKey(provider: string) {
  if (provider === "openai") return process.env.OPENAI_API_KEY;
  if (provider === "claude") return process.env.ANTHROPIC_API_KEY;
  return process.env.GEMINI_API_KEY;
}

// Keeping the original function signature for compatibility but disabling usage.
export async function runAIBucketing(
  columnName: string,
  sampleValues: Array<{ value: string; count: number }>,
  provider: "gemini" | "openai" | "claude",
  guide?: any[] | null
): Promise<any> {
  const buckets = await proposeTaxonomy(columnName, sampleValues, provider, guide);
  // This legacy wrapper is likely deprecated by the new flow, returning basic structure
  return {
    mappedBuckets: [],
    suggestedBuckets: [],
    proposedBuckets: buckets
  };
}
