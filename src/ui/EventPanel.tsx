import { useState } from "react";
import { fmtTime } from "../sim/core";
import { CATALOG } from "../sim/events";
import type { Sim } from "../sim/sim";
import type { STR } from "./i18n";

export function EventPanel({ sim, t, picking, setPicking, spot, clearSpot, onFocus, onClose }: {
  sim: Sim;
  t: (typeof STR)["vi"];
  picking: boolean;
  setPicking: (v: boolean) => void;
  spot: { x: number; z: number; name: string } | null;
  clearSpot: () => void;
  onFocus: (x: number, z: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const active = sim.events.filter((e) => !e.ended);

  const fire = async (value: string) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      const ev = await sim.injectEvent(value, spot ?? undefined);
      setText("");
      clearSpot();
      if (ev?.place) onFocus(ev.place.x, ev.place.z);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="panel pointer-events-auto absolute left-2 top-[76px] z-20 flex max-h-[calc(100vh-200px)] w-[min(340px,calc(100vw-16px))] flex-col overflow-hidden sm:left-3">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
        <h2 className="font-display text-base">🎬 {t.inject}</h2>
        <button className="icon-btn small" aria-label={t.close} onClick={onClose}>✕</button>
      </div>
      <div className="space-y-3 overflow-y-auto p-4">
        <label className="block text-xs opacity-70" htmlFor="ev-text">{t.injectHint}</label>
        <textarea
          id="ev-text"
          className="field h-20 w-full resize-none"
          placeholder={t.injectPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              fire(text);
            }
          }}
        />
        <div className="flex items-center gap-2">
          {spot ? (
            <span className="chip flex-1 truncate">
              📍 {t.spotChosen}: {spot.name || `${spot.x.toFixed(0)}, ${spot.z.toFixed(0)}`}
              <button className="ml-2 underline" onClick={clearSpot}>{t.clear}</button>
            </span>
          ) : (
            <button className={`chip flex-1 text-left ${picking ? "ring-2 ring-[var(--accent)]" : ""}`} onClick={() => setPicking(!picking)}>
              📍 {picking ? t.pickingSpot : t.pickSpot}
            </button>
          )}
          <button className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" disabled={!text.trim() || busy} onClick={() => fire(text)}>
            {busy ? "…" : t.go}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {t.examples.map((ex) => (
            <button key={ex} className="example" disabled={busy} onClick={() => fire(ex)}>
              {ex}
            </button>
          ))}
        </div>
        {active.length > 0 && (
          <div className="pt-1">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-60">{t.active}</div>
            <ul className="space-y-1.5">
              {active.map((ev) => (
                <li key={ev.id} className="flex items-center gap-2 rounded-lg bg-[var(--soft)] px-2.5 py-2 text-sm">
                  <span className="text-lg">{CATALOG[ev.kind].icon}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => ev.place && onFocus(ev.place.x, ev.place.z)}>
                    <div className="truncate font-medium">{ev.headline}</div>
                    <div className="text-[11px] opacity-60">
                      {ev.place?.name ?? "—"} · → {fmtTime(ev.end)}
                    </div>
                  </button>
                  <button className="icon-btn small" aria-label={t.stop} onClick={() => sim.stopEvent(ev.id)}>■</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
