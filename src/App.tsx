import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { Agent } from "./sim/agent";
import { Sim } from "./sim/sim";
import { View } from "./render/scene";
import { loadWorld, type World } from "./world/world";
import { effective, loadPrefs, savePrefs, type Prefs } from "./ui/settings";
import { STR } from "./ui/i18n";
import { TopBar } from "./ui/TopBar";
import { EventPanel } from "./ui/EventPanel";
import { PeoplePanel } from "./ui/PeoplePanel";
import { Feed } from "./ui/Feed";
import { SettingsDialog } from "./ui/SettingsDialog";

/** Re-render the overlay a few times a second; the 3D view runs on its own rAF loop. */
function useTick(sim: Sim | null, hz = 4) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!sim) return;
    const id = setInterval(() => set((n) => n + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [sim, hz]);
}

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [sim, setSim] = useState<Sim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [spot, setSpot] = useState<{ x: number; z: number; name: string } | null>(null);
  const [panels, setPanels] = useState({ left: true, right: true });
  const view = useRef<View | null>(null);
  const pickingRef = useRef(false);
  pickingRef.current = picking;
  const t = STR[prefs.lang];

  useEffect(() => {
    loadWorld().then(setWorld, (e) => setError(String(e?.message ?? e)));
    if (window.innerWidth < 900) setPanels({ left: false, right: false });
  }, []);

  useEffect(() => {
    if (!world || !host.current) return;
    const s = new Sim(world, effective(prefs), window.innerWidth < 900 ? { walkers: 260, bikes: 170 } : {});
    s.setLang(prefs.lang);
    const v = new View(host.current, s, (a: Agent | null, p: THREE.Vector3) => {
      if (pickingRef.current) {
        setSpot({ x: p.x, z: p.z, name: s.streetAt(p.x, p.z) });
        setPicking(false);
        return;
      }
      s.selected = a ? a.id : null;
      s.version++;
    });
    view.current = v;
    setSim(s);
    (window as unknown as { bmhSim: unknown }).bmhSim = { sim: s, view: v };
    return () => v.dispose();
    // the sim is created once per world; prefs changes are pushed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => {
    if (!sim) return;
    sim.mind.configure(effective(prefs));
    sim.setLang(prefs.lang);
    savePrefs(prefs);
  }, [sim, prefs]);

  useTick(sim);

  const select = useCallback(
    (id: number | null) => {
      if (!sim) return;
      sim.selected = id;
      const a = id != null ? sim.agentById(id) : undefined;
      if (a && view.current) {
        view.current.follow = true;
        if (a.state === "inside") view.current.focus(a.home.x, a.home.z, 140);
        else view.current.focus(a.x, a.z, 75);
      }
      sim.version++;
    },
    [sim],
  );

  const focusEvent = useCallback((x: number, z: number) => {
    if (!sim || !view.current) return;
    sim.selected = null;
    view.current.focus(x, z, 220);
  }, [sim]);

  const offline = effective(prefs).provider === "mock";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div ref={host} className={`absolute inset-0 ${picking ? "cursor-crosshair" : ""}`} />
      {!sim && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-display text-4xl tracking-tight">BMH World Simulation <span className="font-mono text-xl opacity-60">v0</span></div>
            <div className="mt-2 text-sm opacity-70">{error ?? (prefs.lang === "vi" ? "Đang dựng 10.000 ngôi nhà…" : "Raising 10,000 houses…")}</div>
          </div>
        </div>
      )}
      {sim && (
        <>
          <TopBar sim={sim} t={t} onSettings={() => setSettingsOpen(true)} panels={panels} setPanels={setPanels} />
          {offline && (
            <div className="pointer-events-auto absolute left-1/2 top-[60px] z-20 flex w-max max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[11px] shadow-lg backdrop-blur sm:top-[64px] sm:rounded-full sm:px-4 sm:text-xs">
              <span className="opacity-80">{t.offline}</span>
              <button className="btn-accent shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold" onClick={() => setSettingsOpen(true)}>
                {t.addKey}
              </button>
            </div>
          )}
          {sim.mind.lastError && !offline && (
            <div className="absolute left-1/2 top-[64px] z-20 max-w-[92vw] -translate-x-1/2 rounded-full bg-[var(--danger)] px-4 py-1.5 text-xs text-white shadow-lg" title={sim.mind.lastError}>
              {t.error}: {sim.mind.lastError.slice(0, 90)}
            </div>
          )}
          {panels.left && (
            <EventPanel
              sim={sim}
              t={t}
              picking={picking}
              setPicking={setPicking}
              spot={spot}
              clearSpot={() => setSpot(null)}
              onFocus={focusEvent}
              onClose={() => setPanels((p) => ({ ...p, left: false }))}
            />
          )}
          {panels.right && <PeoplePanel sim={sim} t={t} select={select} onClose={() => setPanels((p) => ({ ...p, right: false }))} />}
          <Feed sim={sim} t={t} select={select} />
          <div className="pointer-events-none absolute bottom-1 right-2 z-10 text-[10px] opacity-60">{t.about}</div>
        </>
      )}
      {settingsOpen && <SettingsDialog prefs={prefs} sim={sim} onClose={() => setSettingsOpen(false)} onSave={(p) => { setPrefs(p); setSettingsOpen(false); }} />}
    </div>
  );
}
