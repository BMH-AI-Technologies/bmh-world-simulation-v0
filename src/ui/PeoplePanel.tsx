import { T, fmtTime, type ErrandKey } from "../sim/core";
import type { Agent } from "../sim/agent";
import type { Sim } from "../sim/sim";
import type { STR } from "./i18n";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function errandText(sim: Sim, a: Agent) {
  const dict = T[sim.lang].errand as Record<string, string>;
  return dict[a.errand as ErrandKey] ?? String(a.errand);
}

export function PeoplePanel({ sim, t, select, onClose }: { sim: Sim; t: (typeof STR)["vi"]; select: (id: number | null) => void; onClose: () => void }) {
  const sel = sim.selected != null ? sim.agentById(sim.selected) : undefined;
  const res = sim.residentOf(sim.selected);
  const mod = sim.clock.minutes % 1440;

  return (
    <aside className="panel pointer-events-auto absolute right-2 top-[76px] z-20 flex max-h-[calc(100vh-200px)] w-[min(340px,calc(100vw-16px))] flex-col overflow-hidden sm:right-3">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
        <h2 className="font-display text-base">☺ {t.residents}</h2>
        <button className="icon-btn small" aria-label={t.close} onClick={onClose}>✕</button>
      </div>
      {sel && (
        <div className="border-b border-[var(--line)] bg-[var(--soft)] p-4">
          {res ? (
            <>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl" style={{ background: hex(res.p.color) }}>{res.mood}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{res.p.name}, {res.p.age}</div>
                  <div className="text-xs opacity-70">{res.p.job[sim.lang]}</div>
                </div>
                <button className="icon-btn small" aria-label={t.close} onClick={() => select(null)}>✕</button>
              </div>
              <p className="mt-2 text-xs leading-relaxed opacity-80">{res.p.bio[sim.lang]}</p>
              {res.thought && <p className="mt-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-sm italic">“{res.thought}”</p>}
              <div className="mt-2 text-xs"><span className="opacity-60">{t.doing}:</span> {errandText(sim, res.a)}</div>
              {res.plan.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider opacity-60">{t.plan}</div>
                  <ol className="space-y-0.5 text-xs">
                    {res.plan.map((s, i) => (
                      <li key={i} className={`flex gap-2 ${s.at <= mod && (res.plan[i + 1]?.at ?? 1e9) > mod ? "font-semibold text-[var(--accent)]" : s.at < mod ? "opacity-50" : ""}`}>
                        <span className="font-mono tabular-nums">{fmtTime(s.at)}</span>
                        <span className="min-w-0 truncate">{s.place} — {s.activity}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {res.memory.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider opacity-60">{t.memory}</div>
                  <ul className="space-y-0.5 text-xs opacity-80">
                    {res.memory.slice(-5).reverse().map((m, i) => <li key={i}>· {m}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full" style={{ background: hex(sel.color) }} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{sel.kind === "actor" ? sel.name : `${sel.name}${sel.kind === "walker" ? `, ${sel.age}` : ""}`}</div>
                <div className="text-xs opacity-70">
                  {sel.kind === "actor" ? "" : `${(T[sim.lang] as Record<string, unknown>)[sel.role] ?? t.passerby} · `}
                  {errandText(sim, sel)}
                </div>
              </div>
              <button className="icon-btn small" aria-label={t.close} onClick={() => select(null)}>✕</button>
            </div>
          )}
        </div>
      )}
      <ul className="divide-y divide-[var(--line)] overflow-y-auto">
        {sim.residents.map((r) => (
          <li key={r.a.id}>
            <button className={`flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--soft)] ${sim.selected === r.a.id ? "bg-[var(--soft)]" : ""}`} onClick={() => select(r.a.id)}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base" style={{ background: hex(r.p.color) }}>{r.mood}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{r.p.name}</span>
                  <span className="shrink-0 text-[10px] opacity-50">{r.busy ? "…" : r.a.state === "inside" ? "🏠" : ""}</span>
                </div>
                <div className="truncate text-xs opacity-60">{r.thought || r.p.job[sim.lang]}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
