import type { ModelRole, ProviderId } from "../types";

export type JSONSchema = Record<string, unknown>;

/** What the sim is asking for. The mock provider dispatches on this; real providers ignore it. */
export type LLMTask = "ping" | "plan" | "react" | "chat" | "direct";

export interface LLMRequest {
  task: LLMTask;
  role: ModelRole;
  model: string;
  system: string;
  prompt: string;
  schema?: JSONSchema;
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Structured context for the mock provider only — never sent over the network. */
  mock?: unknown;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: Usage;
}

export interface Provider {
  id: ProviderId;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
