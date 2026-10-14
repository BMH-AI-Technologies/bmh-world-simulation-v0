/** "gateway" = Vercel AI Gateway (OpenAI-compatible, CORS-enabled) — the default. */
export type ProviderId = "gateway" | "gemini" | "openai" | "anthropic" | "mock";
/** "mind" = residents' many short decisions; "director" = turning free-text events into world changes. */
export type ModelRole = "mind" | "director";

export interface Settings {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  models: Record<ModelRole, string>;
  /** Hard stop for a session, in USD. 0 = no cap. */
  budgetUsd: number;
}
