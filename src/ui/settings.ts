import { DEFAULT_MODELS } from "../llm/pricing";
import type { Settings } from "../llm/types";
import type { Lang } from "../sim/core";

const KEY = "bmh-world-sim:settings:v1";

export interface Prefs extends Settings {
  remember: boolean;
  lang: Lang;
}

export const DEFAULT_PREFS: Prefs = {
  provider: "gateway",
  apiKey: "",
  baseUrl: "",
  models: { ...DEFAULT_MODELS.gateway },
  budgetUsd: 2,
  remember: true,
  lang: "vi",
};

/** Browser storage can be missing or throw (private mode, previews) — never rely on it. */
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS, lang: navigator.language?.startsWith("vi") ? "vi" : DEFAULT_PREFS.lang };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...p, models: { ...DEFAULT_PREFS.models, ...p.models } };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p.remember ? p : { ...p, apiKey: "" }));
  } catch {
    /* storage unavailable — settings live for this session only */
  }
}

/** Without a key we run the offline mind, whatever provider is selected. */
export function effective(p: Prefs): Settings {
  if (p.provider !== "mock" && !p.apiKey.trim()) return { ...p, provider: "mock" };
  return p;
}
