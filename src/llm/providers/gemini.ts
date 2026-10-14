import { geminiSchema, postJSON } from "./http";
import { ProviderError, type LLMRequest, type LLMResponse, type Provider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

export function createGeminiProvider(apiKey: string, baseUrl?: string): Provider {
  const base = (baseUrl || BASE).replace(/\/$/, "");
  return {
    id: "gemini",
    async complete(req: LLMRequest): Promise<LLMResponse> {
      const generationConfig: Record<string, unknown> = {
        temperature: req.temperature ?? 0.9,
        maxOutputTokens: req.maxTokens ?? 8192,
      };
      // 2.5 Flash-tier models think by default; persona actions don't need it and it
      // multiplies output cost. Pro and 3.x keep their default.
      if (/2\.5-flash/.test(req.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig,
      };
      if (req.schema) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = geminiSchema(req.schema);
      }

      const url = `${base}/models/${encodeURIComponent(req.model)}:generateContent`;
      // Key goes in a header, not the query string, so it never appears in URLs or logs.
      const headers = { "x-goog-api-key": apiKey };
      let json: GeminiResponse;
      try {
        json = (await postJSON(url, headers, body, req.signal)) as GeminiResponse;
      } catch (e) {
        // Some models reject responseSchema features — retry with plain JSON mode;
        // the schema is also spelled out in the prompt, and zod validates after.
        if (e instanceof ProviderError && e.status === 400 && generationConfig.responseSchema) {
          delete generationConfig.responseSchema;
          json = (await postJSON(url, headers, body, req.signal)) as GeminiResponse;
        } else throw e;
      }
      if (json.promptFeedback?.blockReason) {
        throw new ProviderError(`Gemini blocked the prompt: ${json.promptFeedback.blockReason}`);
      }
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? "")
        .join("");
      const u = json.usageMetadata ?? {};
      return {
        text,
        usage: {
          inputTokens: u.promptTokenCount ?? 0,
          outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
        },
      };
    },
  };
}
