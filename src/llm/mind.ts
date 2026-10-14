import type { z } from "zod";
import { createProvider } from ".";
import { callJSON, newMeter, type Meter } from "./json";
import { createMockProvider } from "./mock";
import type { LLMTask, Provider } from "./providers/types";
import type { ModelRole, Settings } from "./types";

interface Job<T> {
  priority: number;
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

/**
 * Every LLM call in the sim goes through here: a small priority queue with a
 * concurrency cap, a running cost meter, a budget stop, and a silent fallback
 * to the offline mock when the provider fails (the world never freezes).
 */
export class MindRuntime {
  meter: Meter = newMeter();
  inFlight = 0;
  lastError: string | null = null;
  private queue: Job<unknown>[] = [];
  private provider: Provider;
  private mock: Provider;

  constructor(
    public settings: Settings,
    private concurrency = 4,
    mockLatencyMs = 120,
  ) {
    this.provider = createProvider(settings);
    this.mock = createMockProvider(mockLatencyMs);
  }

  configure(s: Settings) {
    this.settings = s;
    this.provider = createProvider(s);
    this.lastError = null;
  }

  get live() {
    return this.settings.provider !== "mock";
  }

  get overBudget() {
    return this.settings.budgetUsd > 0 && this.meter.usd >= this.settings.budgetUsd;
  }

  get queued() {
    return this.queue.length;
  }

  call<S extends z.ZodType>(opts: {
    task: LLMTask;
    role: ModelRole;
    system: string;
    prompt: string;
    schema: S;
    mock: unknown;
    priority?: number;
    maxTokens?: number;
  }): Promise<z.output<S>> {
    return new Promise((resolve, reject) => {
      const run = async () => {
        const useMock = !this.live || this.overBudget;
        const base = { task: opts.task, role: opts.role, system: opts.system, prompt: opts.prompt, mock: opts.mock, maxTokens: opts.maxTokens ?? 1500 };
        if (useMock) return callJSON(this.mock, { ...base, model: "mock-deterministic" }, opts.schema);
        try {
          const out = await callJSON(this.provider, { ...base, model: this.settings.models[opts.role] }, opts.schema, this.meter);
          this.lastError = null;
          return out;
        } catch (e) {
          this.lastError = (e as Error).message;
          return callJSON(this.mock, { ...base, model: "mock-deterministic" }, opts.schema);
        }
      };
      this.queue.push({ priority: opts.priority ?? 1, run, resolve: resolve as (v: unknown) => void, reject });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.pump();
    });
  }

  /** Drop low-priority work that piled up (e.g. at 64× speed). */
  trim(max = 24) {
    while (this.queue.length > max) {
      const j = this.queue.pop()!;
      j.reject(new Error("dropped"));
    }
  }

  private pump() {
    while (this.inFlight < this.concurrency && this.queue.length) {
      const job = this.queue.shift()!;
      this.inFlight++;
      job
        .run()
        .then(job.resolve, job.reject)
        .finally(() => {
          this.inFlight--;
          this.pump();
        });
    }
  }
}
