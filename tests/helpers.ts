import fs from "node:fs";
import path from "node:path";
import { World, type BakedWorld } from "../src/world/world";
import type { Settings } from "../src/llm/types";

let cached: World | null = null;
export function testWorld(): World {
  if (!cached) cached = new World(JSON.parse(fs.readFileSync(path.join(__dirname, "../public/data/pho-co.json"), "utf8")) as BakedWorld);
  return cached;
}
export const MOCK: Settings = { provider: "mock", apiKey: "", baseUrl: "", models: { mind: "mock-deterministic", director: "mock-deterministic" }, budgetUsd: 0 };
