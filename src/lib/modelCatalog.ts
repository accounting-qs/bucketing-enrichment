/**
 * Model Catalog — Dynamic AI model fetching from provider APIs
 *
 * Fetches ALL available models from OpenRouter, OpenAI, Gemini, and Anthropic.
 * Results cached server-side for 1 hour.
 */

export interface AIModel {
  id: string;               // API model identifier
  name: string;              // Display name
  provider: "openai" | "gemini" | "claude" | "openrouter";
  inputPrice: number | null; // USD per 1M input tokens (null = free)
  outputPrice: number | null;
  isFree: boolean;
  contextWindow: number;
  description?: string;
}

// In-memory cache
let cachedModels: AIModel[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch all available models from all providers
 */
export async function fetchAllModels(): Promise<AIModel[]> {
  if (cachedModels && Date.now() - cacheTime < CACHE_TTL) {
    return cachedModels;
  }

  const [openrouter, openai, gemini, claude] = await Promise.allSettled([
    fetchOpenRouterModels(),
    fetchOpenAIModels(),
    fetchGeminiModels(),
    getClaudeModels(),
  ]);

  const all: AIModel[] = [
    ...(openai.status === "fulfilled" ? openai.value : []),
    ...(gemini.status === "fulfilled" ? gemini.value : []),
    ...(claude.status === "fulfilled" ? claude.value : []),
    ...(openrouter.status === "fulfilled" ? openrouter.value : []),
  ];

  cachedModels = all;
  cacheTime = Date.now();
  return all;
}

// ============================================================
// OpenRouter — GET https://openrouter.ai/api/v1/models
// ============================================================

async function fetchOpenRouterModels(): Promise<AIModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch("https://openrouter.ai/api/v1/models", { headers, next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = await res.json();
  const models: AIModel[] = [];

  for (const m of data.data || []) {
    // Only include text-output chat models
    const arch = m.architecture || {};
    const outputModalities = arch.output_modalities || arch.modality?.split("+") || [];
    const isTextOutput = outputModalities.includes("text") || !outputModalities.length;
    if (!isTextOutput) continue;

    const inputPrice = parseFloat(m.pricing?.prompt || "0") * 1_000_000;
    const outputPrice = parseFloat(m.pricing?.completion || "0") * 1_000_000;
    const isFree = inputPrice === 0 && outputPrice === 0;

    models.push({
      id: m.id,
      name: m.name || m.id,
      provider: "openrouter",
      inputPrice: isFree ? null : inputPrice,
      outputPrice: isFree ? null : outputPrice,
      isFree,
      contextWindow: m.context_length || 4096,
      description: m.description?.substring(0, 120),
    });
  }

  // Sort: free first, then by name
  return models.sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ============================================================
// OpenAI — GET https://api.openai.com/v1/models
// ============================================================

async function fetchOpenAIModels(): Promise<AIModel[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return getFallbackOpenAIModels();

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return getFallbackOpenAIModels();

    const data = await res.json();
    const chatModels: AIModel[] = [];

    // Filter for chat-capable models (gpt-*)
    for (const m of data.data || []) {
      const id: string = m.id;
      if (!id.startsWith("gpt-") && !id.startsWith("o")) continue;
      // Skip fine-tuned, instruct, and embedding models
      if (id.includes("instruct") || id.includes("embed") || id.includes("ft:")) continue;
      // Skip realtime/audio models
      if (id.includes("realtime") || id.includes("audio") || id.includes("tts")) continue;
      // Skip search/edit deprecated
      if (id.includes("search") || id.includes("edit")) continue;

      const pricing = getOpenAIPricing(id);

      chatModels.push({
        id,
        name: formatOpenAIName(id),
        provider: "openai",
        inputPrice: pricing.input,
        outputPrice: pricing.output,
        isFree: false,
        contextWindow: 128000,
      });
    }

    return chatModels.length > 0 ? chatModels : getFallbackOpenAIModels();
  } catch {
    return getFallbackOpenAIModels();
  }
}

function formatOpenAIName(id: string): string {
  return id
    .replace(/-20\d{2}-\d{2}-\d{2}$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getOpenAIPricing(id: string): { input: number; output: number } {
  // Pricing per 1M tokens (USD) — updated March 2026
  if (id.includes("gpt-5.4")) return { input: 2.50, output: 10.00 };
  if (id.includes("gpt-5") && id.includes("mini")) return { input: 0.30, output: 1.25 };
  if (id.includes("gpt-5") && id.includes("nano")) return { input: 0.10, output: 0.40 };
  if (id.includes("gpt-5")) return { input: 2.00, output: 8.00 };
  if (id.includes("gpt-4.1") && id.includes("nano")) return { input: 0.10, output: 0.40 };
  if (id.includes("gpt-4.1") && id.includes("mini")) return { input: 0.40, output: 1.60 };
  if (id.includes("gpt-4.1")) return { input: 2.00, output: 8.00 };
  if (id.includes("gpt-4o-mini")) return { input: 0.15, output: 0.60 };
  if (id.includes("gpt-4o")) return { input: 2.50, output: 10.00 };
  if (id.includes("o4-mini")) return { input: 1.10, output: 4.40 };
  if (id.includes("o3-mini")) return { input: 1.10, output: 4.40 };
  if (id.includes("o3")) return { input: 2.00, output: 8.00 };
  if (id.includes("o1-mini")) return { input: 1.10, output: 4.40 };
  if (id.includes("o1")) return { input: 15.00, output: 60.00 };
  return { input: 1.00, output: 3.00 }; // fallback
}

function getFallbackOpenAIModels(): AIModel[] {
  return [
    { id: "gpt-5.4", name: "GPT-5.4", provider: "openai", inputPrice: 2.50, outputPrice: 10.00, isFree: false, contextWindow: 128000 },
    { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai", inputPrice: 0.30, outputPrice: 1.25, isFree: false, contextWindow: 128000 },
    { id: "gpt-5-nano", name: "GPT-5 Nano", provider: "openai", inputPrice: 0.10, outputPrice: 0.40, isFree: false, contextWindow: 128000 },
    { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", inputPrice: 2.00, outputPrice: 8.00, isFree: false, contextWindow: 128000 },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai", inputPrice: 0.40, outputPrice: 1.60, isFree: false, contextWindow: 128000 },
    { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai", inputPrice: 0.10, outputPrice: 0.40, isFree: false, contextWindow: 128000 },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai", inputPrice: 2.50, outputPrice: 10.00, isFree: false, contextWindow: 128000 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", inputPrice: 0.15, outputPrice: 0.60, isFree: false, contextWindow: 128000 },
    { id: "o4-mini", name: "O4 Mini", provider: "openai", inputPrice: 1.10, outputPrice: 4.40, isFree: false, contextWindow: 200000 },
    { id: "o3-mini", name: "O3 Mini", provider: "openai", inputPrice: 1.10, outputPrice: 4.40, isFree: false, contextWindow: 200000 },
  ];
}

// ============================================================
// Gemini — GET models list
// ============================================================

async function fetchGeminiModels(): Promise<AIModel[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return getFallbackGeminiModels();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!res.ok) return getFallbackGeminiModels();

    const data = await res.json();
    const models: AIModel[] = [];

    for (const m of data.models || []) {
      const name: string = m.name || "";
      const displayName: string = m.displayName || name;
      const id = name.replace("models/", "");

      // Only include generateContent capable models
      const methods: string[] = m.supportedGenerationMethods || [];
      if (!methods.includes("generateContent")) continue;

      // Skip embedding, vision-only, TTS, and image models
      if (id.includes("embed") || id.includes("tts") || id.includes("imagen") || id.includes("veo")) continue;
      if (id.includes("aqa") || id.includes("bisheng")) continue;

      const pricing = getGeminiPricing(id);

      models.push({
        id,
        name: displayName,
        provider: "gemini",
        inputPrice: pricing.input,
        outputPrice: pricing.output,
        isFree: false,
        contextWindow: m.inputTokenLimit || 32000,
      });
    }

    return models.length > 0 ? models : getFallbackGeminiModels();
  } catch {
    return getFallbackGeminiModels();
  }
}

function getGeminiPricing(id: string): { input: number; output: number } {
  if (id.includes("3.1") && id.includes("pro")) return { input: 1.25, output: 10.00 };
  if (id.includes("3.1") && id.includes("flash-lite")) return { input: 0.02, output: 0.10 };
  if (id.includes("3.1") && id.includes("flash")) return { input: 0.10, output: 0.40 };
  if (id.includes("3") && id.includes("flash")) return { input: 0.10, output: 0.40 };
  if (id.includes("2.5") && id.includes("pro")) return { input: 1.25, output: 10.00 };
  if (id.includes("2.5") && id.includes("flash")) return { input: 0.15, output: 0.60 };
  if (id.includes("2.0") && id.includes("flash-lite")) return { input: 0.02, output: 0.10 };
  if (id.includes("2.0") && id.includes("flash")) return { input: 0.10, output: 0.40 };
  if (id.includes("1.5") && id.includes("pro")) return { input: 1.25, output: 5.00 };
  if (id.includes("1.5") && id.includes("flash")) return { input: 0.075, output: 0.30 };
  return { input: 0.15, output: 0.60 };
}

function getFallbackGeminiModels(): AIModel[] {
  return [
    { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", provider: "gemini", inputPrice: 1.25, outputPrice: 10.00, isFree: false, contextWindow: 1000000 },
    { id: "gemini-3-flash", name: "Gemini 3 Flash", provider: "gemini", inputPrice: 0.10, outputPrice: 0.40, isFree: false, contextWindow: 1000000 },
    { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite", provider: "gemini", inputPrice: 0.02, outputPrice: 0.10, isFree: false, contextWindow: 1000000 },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "gemini", inputPrice: 1.25, outputPrice: 10.00, isFree: false, contextWindow: 1000000 },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", inputPrice: 0.15, outputPrice: 0.60, isFree: false, contextWindow: 1000000 },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini", inputPrice: 0.10, outputPrice: 0.40, isFree: false, contextWindow: 1000000 },
  ];
}

// ============================================================
// Claude — Anthropic (no public list endpoint, static)
// ============================================================

function getClaudeModels(): AIModel[] {
  return [
    { id: "claude-opus-4-20260205", name: "Claude Opus 4.6", provider: "claude", inputPrice: 15.00, outputPrice: 75.00, isFree: false, contextWindow: 200000 },
    { id: "claude-sonnet-4-20260217", name: "Claude Sonnet 4.6", provider: "claude", inputPrice: 3.00, outputPrice: 15.00, isFree: false, contextWindow: 200000 },
    { id: "claude-haiku-4-20251015", name: "Claude Haiku 4.5", provider: "claude", inputPrice: 0.80, outputPrice: 4.00, isFree: false, contextWindow: 200000 },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "claude", inputPrice: 3.00, outputPrice: 15.00, isFree: false, contextWindow: 200000 },
  ];
}

// ============================================================
// Helpers
// ============================================================

export function estimateCost(
  model: AIModel,
  rowCount: number,
  avgTokensPerRow = 200
): { estimatedCost: number; estimatedTimeMinutes: number; costPerRow: number } {
  const totalInputTokens = rowCount * avgTokensPerRow;
  const totalOutputTokens = rowCount * 80; // ~80 output tokens per row
  const inputCost = (model.inputPrice || 0) * (totalInputTokens / 1_000_000);
  const outputCost = (model.outputPrice || 0) * (totalOutputTokens / 1_000_000);
  const estimatedCost = inputCost + outputCost;
  // ~25 rows per batch, ~2s per batch
  const estimatedTimeMinutes = (rowCount / 25) * 2 / 60;
  const costPerRow = rowCount > 0 ? estimatedCost / rowCount : 0;

  return { estimatedCost, estimatedTimeMinutes, costPerRow };
}

export function formatPrice(price: number | null): string {
  if (price === null || price === 0) return "Free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}
