import type { ModelRole, ProviderId } from "./types";

/**
 * USD per 1M tokens. Prices change often — this table is a best-effort
 * snapshot (Oct 2026); treat the meter as an estimate. Unknown models fall back
 * to FALLBACK_PRICE so estimates never silently read $0.
 */
export interface ModelPrice {
  input: number;
  output: number;
  label?: string;
}

export const PRICE_TABLE: Record<string, ModelPrice> = {
  // Vercel AI Gateway (list prices from ai-gateway.vercel.sh/v1/models, Oct 2026)
  "google/gemini-3.8-flash": { input: 0.75, output: 3.75, label: "Gemini 3.8 Flash (Gateway)" },
  "google/gemini-3.5-flash-lite": { input: 0.3, output: 2.5, label: "Gemini 3.5 Flash-Lite (Gateway)" },
  "google/gemini-3.1-flash-lite": { input: 0.25, output: 1.5, label: "Gemini 3.1 Flash-Lite (Gateway)" },
  // Google Gemini
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4, label: "Gemini 2.5 Flash-Lite" },
  "gemini-2.5-flash": { input: 0.3, output: 2.5, label: "Gemini 2.5 Flash" },
  "gemini-2.5-pro": { input: 1.25, output: 10, label: "Gemini 2.5 Pro" },
  "gemini-3-flash-preview": { input: 0.5, output: 3, label: "Gemini 3 Flash (preview)" },
  "gemini-3-pro-preview": { input: 2, output: 12, label: "Gemini 3 Pro (preview)" },
  // OpenAI
  "gpt-5-nano": { input: 0.05, output: 0.4, label: "GPT-5 nano" },
  "gpt-5-mini": { input: 0.25, output: 2, label: "GPT-5 mini" },
  "gpt-5": { input: 1.25, output: 10, label: "GPT-5" },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, label: "GPT-4.1 mini" },
  "gpt-4o-mini": { input: 0.15, output: 0.6, label: "GPT-4o mini" },
  // DeepSeek / OpenRouter style ids
  "deepseek-chat": { input: 0.28, output: 0.42, label: "DeepSeek Chat" },
  "deepseek/deepseek-chat": { input: 0.28, output: 0.42, label: "DeepSeek Chat (OpenRouter)" },
  // Anthropic
  "claude-haiku-5-5": { input: 0.1, output: 0.5, label: "Claude Haiku 5.5" },
  "claude-sonnet-5-5": { input: 2, output: 10, label: "Claude Sonnet 5.5" },
  "claude-opus-5-5": { input: 4, output: 20, label: "Claude Opus 5.5" },
  // Local + mock
  "mock-deterministic": { input: 0, output: 0, label: "Mock (offline)" },
};

export const FALLBACK_PRICE: ModelPrice = { input: 1, output: 4 };

export function priceFor(model: string, overrides?: Record<string, ModelPrice>): ModelPrice {
  return overrides?.[model] ?? PRICE_TABLE[model] ?? (model.includes(":") || model.startsWith("local") ? { input: 0, output: 0 } : FALLBACK_PRICE);
}

export function usdFor(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export const DEFAULT_MODELS: Record<ProviderId, Record<ModelRole, string>> = {
  gateway: { mind: "google/gemini-3.8-flash", director: "google/gemini-3.8-flash" },
  gemini: { mind: "gemini-2.5-flash-lite", director: "gemini-2.5-flash" },
  openai: { mind: "gpt-5-nano", director: "gpt-5-mini" },
  anthropic: { mind: "claude-haiku-5-5", director: "claude-sonnet-5-5" },
  mock: { mind: "mock-deterministic", director: "mock-deterministic" },
};

export const MODEL_SUGGESTIONS: Record<ProviderId, string[]> = {
  gateway: ["google/gemini-3.8-flash", "google/gemini-3.5-flash-lite", "google/gemini-3.1-flash-lite", "anthropic/claude-haiku-5-5", "openai/gpt-5-mini"],
  gemini: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview"],
  openai: ["gpt-5-nano", "gpt-5-mini", "gpt-5", "gpt-4.1-mini", "deepseek-chat", "deepseek/deepseek-chat", "qwen2.5:7b"],
  anthropic: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
  mock: ["mock-deterministic"],
};
