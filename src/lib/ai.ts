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
  provider: "gemini" | "openai" | "claude",
  guide?: any[] | null
): Promise<TaxonomyNode[]> {
  const prompt = `
    You are a Strategic Data Architect. I have a dataset with a column named "${columnName}".
    I need you to propose a hierarchical TAXONOMY (Parent -> Child -> Leaf) to categorize this data.

    SAMPLE VALUES (Top 500):
    ${JSON.stringify(sampleValues.slice(0, 500))}

    TAXONOMY RULES:
    1. ${guide ? "CRITICAL: Use the provided GUIDE as your Strict Foundation. You can Add new buckets if necessary, but do NOT remove guide buckets." : "Create a logical hierarchy from scratch."}
    2. Focus on BROAD categories (e.g., "Finance") breaking down into specific niches (e.g., "Investment Banking").
    3. Propose a nested JSON structure.
    4. Mark any new buckets you discover (that were not in the guide) as "isAiSuggested": true.

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
    const apiKey = getApiKey(provider);
    if (!apiKey) return [];

    let responseText = "";
    if (provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: commonSystem }, { role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      responseText = res.choices[0].message.content || "[]";
    } else if (provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt + "\n\n" + commonSystem }],
      });
      responseText = res.content[0].type === 'text' ? res.content[0].text : '[]';
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
  provider: "gemini" | "openai" | "claude"
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
    5. NEW BUCKETS: If a value fits a Parent but none of its existing Children, definitely suggest a new Child name within that Parent.
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
    const apiKey = getApiKey(provider);
    if (!apiKey) return { mappings: [] };

    let responseText = "";
    if (provider === "openai") {
      const openai = new OpenAI({ apiKey });
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: commonSystem }, { role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      responseText = res.choices[0].message.content || "{}";
    } else if (provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt + "\n\n" + commonSystem }],
      });
      responseText = res.content[0].type === 'text' ? res.content[0].text : '{}';
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const res = await model.generateContent(prompt + "\n\n" + commonSystem);
      responseText = res.response.text();
    }

    const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error(">>> BATCH MAPPING ERROR:", err);
    return { mappings: [] };
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
