import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, BucketDefinition } from "@/types";
import { buildClassificationSystemPrompt, buildBatchUserPrompt } from "./prompts";

// ============================================================
// Provider initialization
// ============================================================

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getGemini(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
}

function getClaude(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ============================================================
// Classification result types
// ============================================================

export interface ClassificationResult {
  index: number;
  bucket_1: { name: string; score: number; reason: string };
  bucket_2: { name: string; score: number; reason: string };
  bucket_3: { name: string; score: number; reason: string };
  generic: boolean;
  disqualified: boolean;
}

export interface BatchResult {
  results: ClassificationResult[];
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// ============================================================
// Main classification function
// ============================================================

/**
 * Classify a batch of values using AI
 * @param batch Array of { index, value } — the original row index and the value to classify
 * @param taxonomy Full taxonomy (25+1 default + custom)
 * @param provider AI provider
 * @param model Optional specific model name
 */
export async function classifyBatch(
  batch: { index: number; value: string }[],
  taxonomy: BucketDefinition[],
  provider: AIProvider,
  model?: string
): Promise<BatchResult> {
  const systemPrompt = buildClassificationSystemPrompt(taxonomy);
  const userPrompt = buildBatchUserPrompt(batch);

  let responseText = "";
  let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  switch (provider) {
    case "gemini": {
      const result = await classifyWithGemini(systemPrompt, userPrompt, model);
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    case "openai": {
      const result = await classifyWithOpenAI(systemPrompt, userPrompt, model);
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    case "claude": {
      const result = await classifyWithClaude(systemPrompt, userPrompt, model);
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    case "openrouter": {
      const result = await classifyWithOpenRouter(systemPrompt, userPrompt, model);
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  // Parse the JSON response
  const results = parseClassificationResponse(responseText, batch);

  return { results, tokenUsage };
}

// ============================================================
// Provider-specific implementations
// ============================================================

async function classifyWithGemini(
  systemPrompt: string,
  userPrompt: string,
  model?: string
) {
  const gemini = getGemini();
  const m = gemini.getGenerativeModel({
    model: model || "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const result = await m.generateContent(userPrompt);
  const response = result.response;

  return {
    text: response.text(),
    tokenUsage: {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
    },
  };
}

async function classifyWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model?: string
) {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: model || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  return {
    text: response.choices[0]?.message?.content || "[]",
    tokenUsage: {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
  };
}

async function classifyWithClaude(
  systemPrompt: string,
  userPrompt: string,
  model?: string
) {
  const claude = getClaude();
  const response = await claude.messages.create({
    model: model || "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");

  return {
    text: textBlock && "text" in textBlock ? textBlock.text : "[]",
    tokenUsage: {
      promptTokens: response.usage?.input_tokens || 0,
      completionTokens: response.usage?.output_tokens || 0,
      totalTokens:
        (response.usage?.input_tokens || 0) +
        (response.usage?.output_tokens || 0),
    },
  };
}

async function classifyWithOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model?: string
) {
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: model || "meta-llama/llama-3.3-70b-instruct",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
  });

  return {
    text: response.choices[0]?.message?.content || "[]",
    tokenUsage: {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
  };
}

// ============================================================
// Response parsing
// ============================================================

function parseClassificationResponse(
  responseText: string,
  batch: { index: number; value: string }[]
): ClassificationResult[] {
  let cleaned = responseText.trim();

  // Strip markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error(">>> Failed to parse AI response as JSON:", cleaned.substring(0, 500));
    // Return all as generic
    return batch.map((item) => ({
      index: item.index,
      bucket_1: { name: "", score: 0, reason: "AI response parse error" },
      bucket_2: { name: "", score: 0, reason: "" },
      bucket_3: { name: "", score: 0, reason: "" },
      generic: true,
      disqualified: false,
    }));
  }

  // Handle both array and object-with-results responses
  let results: unknown[];
  if (Array.isArray(parsed)) {
    results = parsed;
  } else if (parsed && typeof parsed === "object" && "results" in parsed) {
    results = (parsed as { results: unknown[] }).results;
  } else {
    results = [parsed];
  }

  // Map to typed results, filling in missing indices
  const resultMap = new Map<number, ClassificationResult>();

  for (const item of results) {
    const r = item as Record<string, unknown>;
    const idx = (r.index as number) ?? 0;
    const b1 = (r.bucket_1 || r.bucket1 || {}) as Record<string, unknown>;
    const b2 = (r.bucket_2 || r.bucket2 || {}) as Record<string, unknown>;
    const b3 = (r.bucket_3 || r.bucket3 || {}) as Record<string, unknown>;

    resultMap.set(idx, {
      index: idx,
      bucket_1: {
        name: String(b1.name || ""),
        score: Number(b1.score || 0),
        reason: String(b1.reason || ""),
      },
      bucket_2: {
        name: String(b2.name || ""),
        score: Number(b2.score || 0),
        reason: String(b2.reason || ""),
      },
      bucket_3: {
        name: String(b3.name || ""),
        score: Number(b3.score || 0),
        reason: String(b3.reason || ""),
      },
      generic: Boolean(r.generic),
      disqualified: Boolean(r.disqualified),
    });
  }

  // Ensure all batch items have a result
  return batch.map((item) => {
    const existing = resultMap.get(item.index);
    if (existing) return existing;

    // Missing from AI response — mark as generic
    return {
      index: item.index,
      bucket_1: { name: "", score: 0, reason: "Missing from AI response" },
      bucket_2: { name: "", score: 0, reason: "" },
      bucket_3: { name: "", score: 0, reason: "" },
      generic: true,
      disqualified: false,
    };
  });
}
