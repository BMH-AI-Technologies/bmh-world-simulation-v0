import { ProviderError } from "./types";

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * POST JSON with retry on 429 / 5xx / network errors (exponential backoff,
 * honouring Retry-After). Non-retryable 4xx surface immediately with the
 * provider's error message.
 */
export async function postJSON(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
  maxRetries = 3,
): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      if (attempt >= maxRetries) throw new ProviderError(`Network error: ${(e as Error).message}`, undefined, true);
      await sleep(800 * 2 ** attempt, signal);
      attempt++;
      continue;
    }
    if (res.ok) return res.json();
    const text = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < maxRetries) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt + Math.random() * 400, signal);
      attempt++;
      continue;
    }
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message ?? j?.message ?? text;
    } catch {
      /* keep raw text */
    }
    throw new ProviderError(`HTTP ${res.status}: ${String(msg).slice(0, 400)}`, res.status, retryable);
  }
}

/**
 * Turn a zod-generated JSON schema into the conservative subset every provider
 * accepts for structured output: no numeric/length bounds (zod still enforces
 * them after parsing), no $schema, closed objects.
 */
export function portableSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const DROP = new Set([
    "$schema",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "pattern",
    "format",
    "default",
  ]);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (DROP.has(k)) continue;
      out[k] = walk(v);
    }
    if (out.type === "object" && out.properties && out.additionalProperties === undefined) {
      out.additionalProperties = false;
    }
    return out;
  };
  return walk(schema) as Record<string, unknown>;
}

/** Gemini's responseSchema dialect: no additionalProperties. */
export function geminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "additionalProperties") continue;
      out[k] = walk(v);
    }
    return out;
  };
  return walk(portableSchema(schema)) as Record<string, unknown>;
}
