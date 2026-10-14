import { useState } from "react";
import { PROVIDER_LABEL } from "../llm";
import { DEFAULT_MODELS, MODEL_SUGGESTIONS } from "../llm/pricing";
import type { ProviderId } from "../llm/types";
import type { Sim } from "../sim/sim";
import { STR } from "./i18n";
import type { Prefs } from "./settings";

const PROVIDERS: ProviderId[] = ["gateway", "gemini", "openai", "anthropic", "mock"];
const KEY_URL: Partial<Record<ProviderId, string>> = {
  gateway: "https://vercel.com/docs/ai-gateway",
  gemini: "https://aistudio.google.com/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
};

export function SettingsDialog({ prefs, sim, onClose, onSave }: { prefs: Prefs; sim: Sim | null; onClose: () => void; onSave: (p: Prefs) => void }) {
  const [p, setP] = useState<Prefs>(prefs);
  const t = STR[p.lang];
  const m = sim?.mind.meter;
  const setProvider = (provider: ProviderId) => setP({ ...p, provider, models: { ...DEFAULT_MODELS[provider] } });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="panel max-h-[92vh] w-[min(520px,100%)] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="font-display text-lg">⚙ {t.settings}</h2>
          <button className="icon-btn small" aria-label={t.close} onClick={onClose}>✕</button>
        </div>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <div className="mb-1 text-xs opacity-70">{t.language}</div>
            <div className="flex gap-1">
              {(["vi", "en"] as const).map((l) => (
                <button key={l} className={`speed-btn ${p.lang === l ? "on" : ""}`} onClick={() => setP({ ...p, lang: l })}>
                  {l === "vi" ? "Tiếng Việt" : "English"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs opacity-70" htmlFor="prov">{t.provider}</label>
            <select id="prov" className="field w-full" value={p.provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>
              {PROVIDERS.map((id) => <option key={id} value={id}>{PROVIDER_LABEL[id]}</option>)}
            </select>
          </div>
          {p.provider !== "mock" && (
            <>
              <div>
                <label className="mb-1 block text-xs opacity-70" htmlFor="key">
                  {t.apiKey}
                  {KEY_URL[p.provider] && <a className="ml-2 underline" href={KEY_URL[p.provider]} target="_blank" rel="noreferrer">↗</a>}
                </label>
                <input id="key" className="field w-full font-mono" type="password" autoComplete="off" value={p.apiKey} onChange={(e) => setP({ ...p, apiKey: e.target.value })} placeholder={p.provider === "gateway" ? "vck_…" : ""} />
                <p className="mt-1 text-[11px] opacity-60">{t.keyNote}</p>
                <label className="mt-1 flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={p.remember} onChange={(e) => setP({ ...p, remember: e.target.checked })} /> {t.remember}
                </label>
              </div>
              {(["mind", "director"] as const).map((role) => (
                <div key={role}>
                  <label className="mb-1 block text-xs opacity-70" htmlFor={`m-${role}`}>{role === "mind" ? t.modelMind : t.modelDirector}</label>
                  <input id={`m-${role}`} className="field w-full font-mono" list={`ml-${role}`} value={p.models[role]} onChange={(e) => setP({ ...p, models: { ...p.models, [role]: e.target.value } })} />
                  <datalist id={`ml-${role}`}>{MODEL_SUGGESTIONS[p.provider].map((x) => <option key={x} value={x} />)}</datalist>
                </div>
              ))}
              {p.provider === "openai" && (
                <div>
                  <label className="mb-1 block text-xs opacity-70" htmlFor="base">{t.baseUrl}</label>
                  <input id="base" className="field w-full font-mono" value={p.baseUrl} onChange={(e) => setP({ ...p, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs opacity-70" htmlFor="budget">{t.budget}</label>
                <input id="budget" className="field w-32" type="number" min={0} step={0.5} value={p.budgetUsd} onChange={(e) => setP({ ...p, budgetUsd: Math.max(0, Number(e.target.value) || 0) })} />
                {m && <span className="ml-3 text-xs opacity-70">{t.spent}: ${m.usd.toFixed(4)} · {m.calls} {t.calls}</span>}
              </div>
            </>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="chip" onClick={onClose}>{t.close}</button>
          <button className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold" onClick={() => onSave(p)}>{t.save}</button>
        </div>
        <p className="mt-4 text-[11px] opacity-50">{t.about}</p>
      </div>
    </div>
  );
}
