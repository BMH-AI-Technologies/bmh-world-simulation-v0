import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createOpenAICompatibleProvider } from "./providers/openai";
import { createMockProvider } from "./mock";
import type { Provider } from "./providers/types";
import type { Settings } from "./types";

export const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1";

export function createProvider(s: Pick<Settings, "provider" | "apiKey" | "baseUrl">): Provider {
  switch (s.provider) {
    case "gateway":
      return { ...createOpenAICompatibleProvider(s.apiKey, s.baseUrl || GATEWAY_URL), id: "gateway" };
    case "gemini":
      return createGeminiProvider(s.apiKey, s.baseUrl || undefined);
    case "openai":
      return createOpenAICompatibleProvider(s.apiKey, s.baseUrl || undefined);
    case "anthropic":
      return createAnthropicProvider(s.apiKey, s.baseUrl || undefined);
    case "mock":
      return createMockProvider();
  }
}

export const PROVIDER_LABEL: Record<Settings["provider"], string> = {
  gateway: "Vercel AI Gateway",
  gemini: "Google Gemini",
  openai: "OpenAI-compatible",
  anthropic: "Anthropic",
  mock: "Mock (offline)",
};

export type { Provider } from "./providers/types";
