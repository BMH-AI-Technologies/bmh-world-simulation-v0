import type { Sim } from "../sim/sim";
import type { STR } from "./i18n";

const SPEEDS = [1, 4, 16, 64];

export function TopBar({ sim, t, onSettings, panels, setPanels }: {
  sim: Sim;
  t: (typeof STR)["vi"];
  onSettings: () => void;
  panels: { left: boolean; right: boolean };
  setPanels: (f: (p: { left: boolean; right: boolean }) => { left: boolean; right: boolean }) => void;
}) {
  const [time, day] = sim.clock.label(sim.lang).split(" · ");
  const m = sim.mind.meter;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 sm:p-3">
      <div className="panel pointer-events-auto flex items-center gap-3 px-1.5 py-1.5 sm:px-3 sm:py-2">
        <button className="icon-btn" aria-label={t.inject} onClick={() => setPanels((p) => ({ ...p, left: !p.left }))}>
          ✦
        </button>
        <div className="hidden leading-tight sm:block">
          <div className="flex items-center gap-2 font-display text-lg tracking-tight sm:text-xl">
            BMH World Simulation <span className="rounded-md bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-ink)]">v0</span>
          </div>
          <div className="hidden text-[11px] opacity-60 sm:block">{t.tagline}</div>
        </div>
      </div>

      <div className="panel pointer-events-auto flex min-w-0 items-center gap-1.5 px-1.5 py-1.5 sm:gap-3 sm:px-3">
        <div className="text-center leading-none">
          <div className="font-mono text-lg font-semibold tabular-nums sm:text-2xl">{time}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider opacity-60">{day}</div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button className="icon-btn" aria-label={sim.paused ? t.play : t.pause} onClick={() => { sim.paused = !sim.paused; sim.version++; }}>
            {sim.paused ? "▶" : "❚❚"}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} className={`speed-btn ${s === 4 ? "max-sm:hidden" : ""} ${sim.speed === s && !sim.paused ? "on" : ""}`} onClick={() => { sim.speed = s; sim.paused = false; sim.version++; }}>
              {s}×
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-1 text-[11px] md:flex">
          {sim.weather.rain > 0.2 && <span className="chip">🌧️ {t.raining}</span>}
          {sim.walkingStreet && <span className="chip">🚶 {t.walkingStreet}</span>}
          {sim.nightMarket && <span className="chip">🏮 {t.nightMarket}</span>}
        </div>
      </div>

      <div className="panel pointer-events-auto flex items-center gap-0.5 px-1 py-1.5 sm:gap-1 sm:px-2">
        {sim.mind.live && (
          <span className="hidden px-1 font-mono text-[11px] opacity-70 sm:inline" title={`${m.calls} ${t.calls}`}>
            ${m.usd.toFixed(3)}
            {sim.mind.inFlight > 0 && <span className="ml-1 animate-pulse">●</span>}
          </span>
        )}
        <button className="icon-btn" aria-label={t.residents} onClick={() => setPanels((p) => ({ ...p, right: !p.right }))}>
          ☺
        </button>
        <button className="icon-btn" aria-label={t.settings} onClick={onSettings}>
          ⚙
        </button>
      </div>
    </div>
  );
}
