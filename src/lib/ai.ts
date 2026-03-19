import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, BucketDefinition } from "@/types";
import { buildClassificationSystemPrompt, buildBatchUserPrompt } from "./prompts";

// ============================================================
// Provider initialization
// ============================================================

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getGemini(): GoogleGenerativeAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function getClaude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
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
// Retry helper with timeout
// ============================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  timeoutMs = 60000,
  label = ""
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[AI ${label}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${errMsg}`);

      if (attempt === maxRetries) throw err;

      // Wait before retry: 2s, 5s
      const delay = attempt === 0 ? 2000 : 5000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

// ============================================================
// Main classification function
// ============================================================

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

  const label = `${provider}/${model || "default"}`;
  console.log(`[AI ${label}] Classifying batch of ${batch.length} items...`);

  switch (provider) {
    case "gemini": {
      const result = await withRetry(
        () => classifyWithGemini(systemPrompt, userPrompt, model),
        2, 90000, label
      );
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    case "openai": {
      const result = await withRetry(
        () => classifyWithOpenAI(systemPrompt, userPrompt, model),
        2, 90000, label
      );
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    case "claude": {
      const result = await withRetry(
        () => classifyWithClaude(systemPrompt, userPrompt, model),
        2, 90000, label
      );
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    case "openrouter": {
      const result = await withRetry(
        () => classifyWithOpenRouter(systemPrompt, userPrompt, model),
        2, 120000, label // OpenRouter can be slower
      );
      responseText = result.text;
      tokenUsage = result.tokenUsage;
      break;
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  console.log(`[AI ${label}] Got response (${responseText.length} chars), parsing...`);

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
    generationConfig: {
      responseMimeType: "application/json",
    },
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

  // Force JSON output by adding instruction
  const enhancedUser = `${userPrompt}\n\nIMPORTANT: Return ONLY a JSON array. No markdown, no code blocks, just the raw JSON array.`;

  const response = await claude.messages.create({
    model: model || "claude-sonnet-4-20250514",
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: "user", content: enhancedUser }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "[]";

  console.log(`[Claude] Response status: ${response.stop_reason}, model: ${response.model}, text length: ${text.length}`);

  return {
    text,
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
