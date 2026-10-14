import { portableSchema, postJSON } from "./http";
import { ProviderError, type LLMRequest, type LLMResponse, type Provider } from "./types";

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * OpenAI-compatible chat completions. Covers OpenAI, OpenRouter, DeepSeek,
 * Groq, and local Ollama / LM Studio via base URL.
 */
export function createOpenAICompatibleProvider(apiKey: string, baseUrl?: string): Provider {
  const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const isOpenAI = /api\.openai\.com/.test(base);
  return {
    id: "openai",
    async complete(req: LLMRequest): Promise<LLMResponse> {
      const reasoningModel = /^(gpt-5|o\d)/.test(req.model);
      const body: Record<string, unknown> = {
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      };
      if (!reasoningModel) body.temperature = req.temperature ?? 0.9;
      if (isOpenAI || reasoningModel) body.max_completion_tokens = req.maxTokens ?? 8192;
      else body.max_tokens = req.maxTokens ?? 8192;
      if (isOpenAI && /^gpt-5/.test(req.model) && req.role === "mind") body.reasoning_effort = "minimal";
      // Vercel AI Gateway: Gemini 3.x thinks by default (5–17 s, and the hidden
      // reasoning eats max_tokens). "low" turns it off: ~3 s, 0 reasoning tokens.
      // ("minimal" hangs on the gateway as of Oct 2026.)
      if (/ai-gateway\.vercel\.sh/.test(base)) body.reasoning_effort = "low";

      // Try strict JSON schema → json_object → plain prompt, since compatible
      // servers differ in what they support.
      const formats: unknown[] = req.schema
        ? [
            { type: "json_schema", json_schema: { name: req.schemaName ?? "result", schema: portableSchema(req.schema), strict: false } },
            { type: "json_object" },
            undefined,
          ]
        : [undefined];

      const headers: Record<string, string> = {};
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      if (/openrouter\.ai|ai-gateway\.vercel\.sh/.test(base)) {
        headers["x-title"] = "BMH World Simulation";
      }

      let lastErr: unknown;
      for (const fmt of formats) {
        if (fmt) body.response_format = fmt;
        else delete body.response_format;
        try {
          const json = (await postJSON(`${base}/chat/completions`, headers, body, req.signal)) as ChatResponse;
          const msg = json.choices?.[0]?.message;
          if (msg?.refusal) throw new ProviderError(`Model refused: ${msg.refusal}`);
          return {
            text: msg?.content ?? "",
            usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
          };
        } catch (e) {
          lastErr = e;
          if (!(e instanceof ProviderError && (e.status === 400 || e.status === 422))) throw e;
        }
      }
      throw lastErr;
    },
  };
}
