import { portableSchema, postJSON } from "./http";
import { ProviderError, type LLMRequest, type LLMResponse, type Provider } from "./types";

interface MessagesResponse {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  stop_details?: { category?: string | null; explanation?: string } | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Anthropic Messages API called straight from the browser. Structured output
 * uses `output_config.format` (forced tool_choice is rejected on current
 * models). Sampling params are omitted — current models reject non-defaults.
 */
export function createAnthropicProvider(apiKey: string, baseUrl?: string): Provider {
  const base = (baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  return {
    id: "anthropic",
    async complete(req: LLMRequest): Promise<LLMResponse> {
      const outputConfig: Record<string, unknown> = {
        // Persona actions are short and many: keep thinking cheap.
        effort: req.role === "mind" ? "low" : "medium",
      };
      if (req.schema) outputConfig.format = { type: "json_schema", schema: portableSchema(req.schema) };
      const body: Record<string, unknown> = {
        model: req.model,
        max_tokens: req.maxTokens ? Math.max(req.maxTokens, 4000) : 16000,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: outputConfig,
      };
      const headers = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      };
      const url = `${base}/v1/messages`;
      let json: MessagesResponse;
      try {
        json = (await postJSON(url, headers, body, req.signal)) as MessagesResponse;
      } catch (e) {
        // Older models don't know output_config — fall back to prompt-only JSON.
        if (e instanceof ProviderError && e.status === 400 && body.output_config) {
          delete body.output_config;
          json = (await postJSON(url, headers, body, req.signal)) as MessagesResponse;
        } else throw e;
      }
      if (json.stop_reason === "refusal") {
        throw new ProviderError(`Model declined (${json.stop_details?.category ?? "refusal"})`);
      }
      const text = (json.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      return {
        text,
        usage: { inputTokens: json.usage?.input_tokens ?? 0, outputTokens: json.usage?.output_tokens ?? 0 },
      };
    },
  };
}
