import { z } from "zod";
import { usdFor } from "./pricing";
import type { LLMRequest, Provider, Usage } from "./providers/types";

export interface Meter {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

export const newMeter = (): Meter => ({ calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });

export function addUsage(m: Meter, model: string, u: Usage) {
  m.calls += 1;
  m.inputTokens += u.inputTokens;
  m.outputTokens += u.outputTokens;
  m.usd += usdFor(model, u.inputTokens, u.outputTokens);
}

export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
}

/** Pull a JSON value out of a reply that may wrap it in prose or ``` fences. */
export function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.search(/[[{]/);
  if (start >= 0) {
    const open = trimmed[start];
    const close = open === "{" ? "}" : "]";
    const end = trimmed.lastIndexOf(close);
    if (end > start) return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new SyntaxError("No JSON found in model output");
}

export type JSONRequest = Omit<LLMRequest, "schema">;

/**
 * One structured call: the schema goes to the provider's native JSON mode AND
 * into the prompt, the reply is zod-validated, and one retry carries the
 * validation error back to the model.
 */
export async function callJSON<S extends z.ZodType>(provider: Provider, req: JSONRequest, schema: S, meter?: Meter): Promise<z.output<S>> {
  const jsonSchema = jsonSchemaOf(schema);
  const schemaHint = `\n\nTrả lời DUY NHẤT bằng JSON hợp lệ theo JSON Schema sau (không thêm chữ nào khác):\n${JSON.stringify(jsonSchema)}`;
  let prompt = req.prompt + schemaHint;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await provider.complete({ ...req, prompt, schema: jsonSchema });
    if (meter) addUsage(meter, req.model, res.usage);
    try {
      const parsed = schema.safeParse(extractJSON(res.text));
      if (parsed.success) return parsed.data;
      lastErr = parsed.error;
      prompt = `${req.prompt}${schemaHint}\n\nLần trả lời trước không hợp lệ: ${parsed.error.message.slice(0, 600)}\nHãy trả lời lại đúng schema.`;
    } catch (e) {
      lastErr = e;
      prompt = `${req.prompt}${schemaHint}\n\nLần trả lời trước không phải JSON hợp lệ. Chỉ trả về JSON.`;
    }
  }
  throw new Error(`Model output failed validation twice: ${String((lastErr as Error)?.message ?? lastErr).slice(0, 300)}`);
}
