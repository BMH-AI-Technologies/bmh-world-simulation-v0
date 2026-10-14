import { useState } from "react";
import { fmtTime } from "../sim/core";
import type { Sim } from "../sim/sim";
import type { STR } from "./i18n";

export function Feed({ sim, t, select }: { sim: Sim; t: (typeof STR)["vi"]; select: (id: number | null) => void }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 640);
  const items = sim.feed.slice(-40).reverse();
  return (
    <section className="panel pointer-events-auto absolute bottom-5 left-1/2 z-20 w-[min(720px,calc(100vw-16px))] -translate-x-1/2 overflow-hidden">
      <button className="flex w-full items-center justify-between px-4 py-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-display text-sm">📰 {t.feed}</span>
        <span className="text-xs opacity-60">{open ? "▾" : "▴"}</span>
      </button>
      {open && (
        <ul className="max-h-[22vh] space-y-1 overflow-y-auto px-4 pb-3 text-[13px] leading-snug">
          {items.map((f) => (
            <li key={f.id} className={`flex gap-2 ${f.kind === "event" ? "font-semibold" : ""} ${f.kind === "system" ? "opacity-60" : ""}`}>
              <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums opacity-50">{fmtTime(f.t)}</span>
              <span className="shrink-0">{f.icon}</span>
              <span className="min-w-0 whitespace-pre-line">
                {f.who && (
                  <button className="mr-1 font-semibold text-[var(--accent)] hover:underline" onClick={() => f.whoId && select(f.whoId)}>
                    {f.who}:
                  </button>
                )}
                {f.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
