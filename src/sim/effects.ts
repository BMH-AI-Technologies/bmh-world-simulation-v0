import type { Agent, Trip } from "./agent";
import type { WorldEvent } from "./events";
import type { Sim } from "./sim";

/**
 * How each event kind is *performed*: who shows up (actors), what the crowd
 * does, which streets change. Visual props live in render/props.ts and read
 * `ev.fx`, so everything here stays renderer-agnostic and testable.
 */

const vi = (s: Sim, a: string, b: string) => (s.lang === "vi" ? a : b);

function waysNear(sim: Sim, x: number, z: number, r: number): number[] {
  const nodes = new Set(sim.world.nodesWithin(x, z, r));
  const out: number[] = [];
  sim.world.data.ways.forEach((w, i) => {
    if (w.p.some((n) => nodes.has(n))) out.push(i);
  });
  return out;
}

function edgeNodes(sim: Sim) {
  const { world } = sim;
  const half = world.data.meta.half;
  return world.driveNodes.filter((n) => Math.abs(world.nx[n]) > half.x - 70 || Math.abs(world.nz[n]) > half.z - 70);
}

function ringNodes(sim: Sim, x: number, z: number, rMin: number, rMax: number) {
  const { world } = sim;
  return world.nodesWithin(x, z, rMax).filter((n) => Math.hypot(world.nx[n] - x, world.nz[n] - z) >= rMin);
}

/** Stitch the baked rail fragments into one polyline and cut ±span around a point. */
export function railRoute(sim: Sim, cx: number, cz: number, span = 520): number[][] {
  const frags = sim.world.data.rails.map((r) => {
    const pts: number[][] = [];
    for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]]);
    return pts;
  });
  const close = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 3;
  // greedy chain from the fragment nearest the point
  let bestI = 0, bestD = Infinity;
  frags.forEach((f, i) => f.forEach((p) => {
    const d = Math.hypot(p[0] - cx, p[1] - cz);
    if (d < bestD) { bestD = d; bestI = i; }
  }));
  let chain = frags.splice(bestI, 1)[0] ?? [];
  for (let guard = 0; guard < 50 && frags.length; guard++) {
    const i = frags.findIndex((f) => close(f[0], chain[chain.length - 1]) || close(f[f.length - 1], chain[chain.length - 1]) || close(f[0], chain[0]) || close(f[f.length - 1], chain[0]));
    if (i < 0) break;
    const f = frags.splice(i, 1)[0];
    if (close(f[0], chain[chain.length - 1])) chain = chain.concat(f.slice(1));
    else if (close(f[f.length - 1], chain[chain.length - 1])) chain = chain.concat(f.reverse().slice(1));
    else if (close(f[f.length - 1], chain[0])) chain = f.concat(chain.slice(1));
    else chain = f.reverse().concat(chain.slice(1));
  }
  // densify, then cut to the window around the point
  const dense: number[][] = [];
  for (let i = 1; i < chain.length; i++) {
    const [x0, z0] = chain[i - 1], [x1, z1] = chain[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 4));
    for (let k = 0; k < n; k++) dense.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]);
  }
  if (chain.length) dense.push(chain[chain.length - 1]);
  return dense.filter(([x, z]) => Math.hypot(x - cx, z - cz) < span);
}

function nearestBuilding(sim: Sim, x: number, z: number) {
  let best = -1, bd = Infinity, bx = x, bz = z, bh = 10;
  sim.world.data.buildings.forEach((b, i) => {
    if (b.k === "roof") return;
    let cx = 0, cz = 0;
    const n = b.r.length / 2;
    for (let j = 0; j < b.r.length; j += 2) { cx += b.r[j]; cz += b.r[j + 1]; }
    cx /= n; cz /= n;
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) { bd = d; best = i; bx = cx; bz = cz; bh = b.h; }
  });
  return { i: best, x: bx, z: bz, h: bh };
}

const HUES = [0xe63946, 0xffd60a, 0xffffff, 0x3a86ff];

export function startEvent(sim: Sim, ev: WorldEvent) {
  const { world, rand: r } = sim;
  const p = ev.place;
  if (p) ev.fx.ways = waysNear(sim, p.x, p.z, Math.min(ev.radius, 140));
  switch (ev.kind) {
    case "rain":
      sim.weather.rainTarget = Math.max(sim.weather.rainTarget, 0.4 + ev.intensity * 0.6);
      break;
    case "storm":
      sim.weather.rainTarget = 1;
      sim.weather.storm = true;
      break;
    case "outage":
      sim.outages.push({ x: p?.x ?? 0, z: p?.z ?? 0, r: p ? ev.radius : Infinity });
      break;
    case "flood": {
      const f = { x: p?.x ?? 0, z: p?.z ?? 0, r: ev.radius, level: 0, target: 0.25 + ev.intensity * 0.35 };
      sim.floods.push(f);
      sim.weather.rainTarget = Math.max(sim.weather.rainTarget, 0.5);
      break;
    }
    case "fire": {
      if (!p) break;
      const b = nearestBuilding(sim, p.x, p.z);
      ev.fx.bx = b.x; ev.fx.bz = b.z; ev.fx.bh = b.h; ev.fx.heat = 0.5 + ev.intensity * 0.5;
      // a fire burns until the engine puts it out (hard cap so it can't run forever)
      ev.end = ev.start + 360;
      const edges = edgeNodes(sim);
      const from = edges.length ? edges.reduce((best, n) => (Math.hypot(world.nx[n] - b.x, world.nz[n] - b.z) < Math.hypot(world.nx[best] - b.x, world.nz[best] - b.z) ? n : best), edges[0]) : world.driveNodes[0];
      const truck = sim.spawnActor({ actor: "firetruck", name: vi(sim, "Xe cứu hỏa 114", "Fire engine 114"), speed: 12, state: "idle" }, ev, world.nx[from], world.nz[from]);
      sim.send(truck, { node: world.nearestNode(b.x, b.z, true), label: vi(sim, "đi chữa cháy", "responding"), then: "idle", dwell: 999 });
      ev.fx.truck = truck.id;
      break;
    }
    case "festival":
    case "filming":
      if (p) {
        for (let i = 0; i < (ev.kind === "festival" ? 3 : 2); i++) {
          const a = sim.spawnActor({ actor: ev.kind === "festival" ? "performer" : i === 0 ? "camera" : "performer", name: ev.kind === "festival" ? vi(sim, "Nghệ sĩ", "Performer") : i === 0 ? vi(sim, "Đoàn làm phim", "Film crew") : vi(sim, "Diễn viên", "Actor"), color: r.pick(HUES), speed: 2 }, ev, p.x + r.range(-4, 4), p.z + r.range(-4, 4));
          a.state = "idle";
        }
      }
      break;
    case "lion_dance":
    case "parade": {
      if (!p) break;
      const route = ringNodes(sim, p.x, p.z, 0, Math.max(ev.radius * 2, 120));
      const lead = ev.kind === "lion_dance" ? 4 : 18;
      const start = route.length ? r.pick(route) : p.node;
      for (let i = 0; i < lead; i++) {
        const type = ev.kind === "lion_dance" ? (i < 2 ? "lion" : "drummer") : "marcher";
        const a = sim.spawnActor({ actor: type, name: type === "lion" ? vi(sim, "Lân", "Lion") : type === "drummer" ? vi(sim, "Người đánh trống", "Drummer") : vi(sim, "Người diễu hành", "Marcher"), color: type === "lion" ? (i === 0 ? 0xffc300 : 0xd00000) : r.pick(HUES), speed: type === "lion" ? 2.6 : 2.3, flag: type === "marcher", side: r.range(-0.8, 0.8), state: "idle", until: sim.clock.minutes + i * 0.35 }, ev, world.nx[start], world.nz[start]);
        a.home = { node: start, x: world.nx[start], z: world.nz[start] };
      }
      ev.fx.route = route;
      ev.fx.next = route.length ? r.pick(route) : p.node;
      break;
    }
    case "celebration": {
      const lakeDrive = world.driveNodes.filter((n) => world.lakeNodes.some((l) => Math.hypot(world.nx[l] - world.nx[n], world.nz[l] - world.nz[n]) < 70));
      ev.fx.loop = lakeDrive;
      const count = Math.round(80 + ev.intensity * 100);
      const edges = edgeNodes(sim);
      for (let i = 0; i < count; i++) {
        const n = r.pick(edges.length ? edges : world.driveNodes);
        const a = sim.spawnActor({ actor: "marcher", name: vi(sim, "Cổ động viên", "Fan"), kind: "bike", flag: true, color: r.pick([0xda251d, 0xda251d, 0xffcd00, 0x222222]), speed: r.range(5.5, 8), side: r.range(-1, 1), hat: 2, state: "idle", until: sim.clock.minutes + r.range(0, 6) }, ev, world.nx[n], world.nz[n]);
        a.home.node = n;
      }
      break;
    }
    case "jam": {
      if (!p) break;
      const edges = edgeNodes(sim);
      for (let i = 0; i < 70; i++) {
        const n = r.pick(edges.length ? edges : world.driveNodes);
        const a = sim.spawnActor({ actor: "marcher", name: vi(sim, "Người chạy xe", "Rider"), kind: "bike", color: r.pick([0x111111, 0xc1121f, 0xe5e5e5, 0x1d3557]), speed: r.range(5, 7), side: r.range(-1, 1), hat: 2, state: "idle", until: sim.clock.minutes + r.range(0, 10) }, ev, world.nx[n], world.nz[n]);
        a.home.node = n;
      }
      break;
    }
    case "roadblock":
    case "accident":
      if (p) {
        const pol = sim.spawnActor({ actor: "police", name: vi(sim, "CSGT", "Traffic police"), color: 0xc9b458, speed: 2 }, ev, p.x + 3, p.z + 2);
        pol.state = "idle";
        if (ev.kind === "accident") {
          const edges = edgeNodes(sim);
          const n = edges.length ? r.pick(edges) : world.driveNodes[0];
          const amb = sim.spawnActor({ actor: "ambulance", name: vi(sim, "Xe cấp cứu 115", "Ambulance 115"), speed: 8.5 }, ev, world.nx[n], world.nz[n]);
          sim.send(amb, { node: world.nearestNode(p.x, p.z, true), label: vi(sim, "cấp cứu", "responding"), then: "idle", dwell: 999 });
        }
      }
      break;
    case "train": {
      const cx = p?.x ?? 0, cz = p?.z ?? 0;
      const route = railRoute(sim, cx, cz);
      ev.fx.rail = route.flat();
      let len = 0, atStreet = 0, best = Infinity;
      for (let i = 1; i < route.length; i++) {
        len += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
        const d = Math.hypot(route[i][0] - cx, route[i][1] - cz);
        if (d < best) { best = d; atStreet = len; }
      }
      ev.fx.len = len;
      // enter shortly before the famous stretch so the viewer sees it arrive
      const s0 = Math.max(0, atStreet - 120);
      ev.fx.s = s0;
      // train runs at ~9 m/s on screen; duration follows from the remaining track
      ev.end = ev.start + ((len - s0 + 140) / 9) * 0.5;
      break;
    }
    case "animal": {
      if (!p) break;
      const kind = ev.animal ?? "dog";
      const n = kind === "chicken" ? 5 : 1;
      for (let i = 0; i < n; i++) {
        const a = sim.spawnActor({ actor: kind, name: kind === "buffalo" ? vi(sim, "Con trâu", "Buffalo") : kind === "dog" ? vi(sim, "Con chó", "Dog") : vi(sim, "Con gà", "Chicken"), speed: kind === "buffalo" ? 2.2 : kind === "dog" ? 5 : 3.2, state: "idle", color: kind === "buffalo" ? 0x3d3d3d : kind === "dog" ? 0xc68642 : 0xf5f5f5 }, ev, p.x + r.range(-3, 3), p.z + r.range(-3, 3));
        a.home.node = p.node;
      }
      break;
    }
  }
}

export function tickEvent(sim: Sim, ev: WorldEvent, dt: number) {
  const { world, rand: r } = sim;
  const m = sim.clock.minutes;
  const p = ev.place;
  // a failed route costs a full graph search — never retry it on the next frame
  const go = (a: Agent, trip: Trip) => {
    if (!sim.send(a, trip)) a.until = m + 1 + r.next() * 2;
  };
  for (const a of sim.actors) {
    if (a.eventId !== ev.id || a.state === "move") continue;
    if (a.actor === "firetruck" && !ev.fx.arrived && a.trip?.then === "idle") {
      ev.fx.arrived = true;
      ev.fx.arrivedAt = m;
      for (let i = 0; i < 3; i++) {
        const f = sim.spawnActor({ actor: "firefighter", name: vi(sim, "Lính cứu hỏa", "Firefighter"), color: 0x2b2d42, speed: 2.5 }, ev, a.x + r.range(-3, 3), a.z + r.range(-3, 3));
        f.state = "idle";
        f.until = Infinity;
        f.heading = Math.atan2((ev.fx.bx as number) - f.x, (ev.fx.bz as number) - f.z);
      }
      sim.log({ kind: "event", icon: "🚒", text: vi(sim, "Xe cứu hỏa đã tới hiện trường.", "The fire engine has arrived.") });
      continue;
    }
    if (m < a.until) continue;
    switch (a.actor) {
      case "lion":
      case "drummer":
      case "marcher": {
        if (ev.kind === "celebration") {
          const loop = ev.fx.loop as number[];
          if (loop?.length) go(a, { node: r.pick(loop), label: "cheer", then: "next", dwell: 0 });
        } else if (ev.kind === "jam" && p) {
          const hub = (ev.fx.hub as number | undefined) ?? (ev.fx.hub = world.nearestNode(p.x, p.z, true));
          const target = a.trip?.node === hub ? r.pick(world.driveNodes) : hub;
          go(a, { node: target, label: "ride", then: "next", dwell: 0 });
        } else {
          // the whole troupe walks to the same next stop; a shared waypoint keeps them in a column
          const route = ev.fx.route as number[];
          if (a.trip?.node === ev.fx.next || !a.trip) {
            if (route?.length && sim.actors.filter((b) => b.eventId === ev.id && b.state === "move").length === 0) ev.fx.next = r.pick(route);
          }
          go(a, { node: ev.fx.next as number, label: ev.kind === "lion_dance" ? "lion" : "parade", then: "next", dwell: 0 });
          a.until = Math.max(a.until, m + 0.5);
        }
        break;
      }
      case "buffalo":
      case "dog":
      case "chicken": {
        if (!p) break;
        const ns = ringNodes(sim, p.x, p.z, 0, ev.radius * 1.6);
        if (ns.length) go(a, { node: r.pick(ns), label: "wander", then: "next", dwell: 0 });
        a.until = m + r.range(0, 3);
        break;
      }
    }
  }
  if (ev.kind === "fire") {
    if (ev.fx.arrived) ev.fx.heat = Math.max(0, (ev.fx.heat as number) - dt * 0.012);
    if ((ev.fx.heat as number) <= 0.02 && !ev.fx.out) {
      ev.fx.out = true;
      ev.end = Math.min(ev.end, m + 6);
      sim.log({ kind: "event", icon: "✅", text: vi(sim, "Đám cháy đã được dập tắt, không ai bị thương.", "The fire is out; nobody was hurt.") });
    }
  }
  if (ev.kind === "train") {
    ev.fx.s = (ev.fx.s as number) + dt * 9;
  }
}

export function endEvent(sim: Sim, ev: WorldEvent) {
  switch (ev.kind) {
    case "rain":
    case "storm":
      if (!sim.events.some((e) => e !== ev && !e.ended && (e.kind === "rain" || e.kind === "storm"))) {
        sim.weather.rainTarget = 0;
        sim.weather.storm = false;
        for (const a of sim.walkers) a.umbrella = false;
      }
      break;
    case "outage":
      sim.outages.shift();
      break;
    case "flood":
      sim.floods.shift();
      if (!sim.events.some((e) => e !== ev && !e.ended && (e.kind === "rain" || e.kind === "storm"))) sim.weather.rainTarget = 0;
      break;
  }
  sim.removeActors(ev);
  for (const a of [...sim.walkers, ...sim.residents.map((r) => r.a)]) {
    if (a.eventId !== ev.id) continue;
    a.eventId = undefined;
    a.flag = false;
    if (a.state === "watch") {
      a.state = "idle";
      a.until = sim.clock.minutes;
    }
  }
  sim.log({ kind: "system", icon: "🏁", text: vi(sim, `Kết thúc: ${ev.headline}`, `Over: ${ev.headline}`) });
}

const curiosity = (a: Agent) => (a.role === "tourist" ? 0.8 : a.role === "student" ? 0.75 : a.role === "vendor" ? 0.3 : a.age > 70 ? 0.25 : 0.5);

function watchTrip(sim: Sim, ev: WorldEvent, a: Agent): Trip | null {
  const p = ev.place;
  if (!p) return null;
  const inner = ev.kind === "fire" ? ev.radius * 0.55 : ev.kind === "train" ? 6 : ev.radius * 0.35;
  let ns = ringNodes(sim, p.x, p.z, inner, Math.max(ev.radius * 1.1, inner + 25));
  if (ev.kind === "train") {
    const rail = ev.fx.rail as number[];
    ns = ns.filter((n) => {
      for (let i = 0; i < rail.length; i += 8) if (Math.hypot(sim.world.nx[n] - rail[i], sim.world.nz[n] - rail[i + 1]) < 5) return false;
      return true;
    });
  }
  if (!ns.length) return null;
  a.eventId = ev.id;
  return { node: sim.rand.pick(ns), label: ev.kind === "celebration" ? "cheer" : "watch", then: "watch", dwell: Math.max(5, ev.end - sim.clock.minutes), lookX: p.x, lookZ: p.z };
}

function awayTrip(sim: Sim, ev: WorldEvent, a: Agent): Trip | null {
  const p = ev.place;
  if (!p) return null;
  const dx = a.x - p.x, dz = a.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  const tx = p.x + (dx / d) * ev.radius * 2.6, tz = p.z + (dz / d) * ev.radius * 2.6;
  return { node: sim.world.nearestNode(tx, tz), label: "flee", then: "idle", dwell: 15 };
}

/** One sweep of crowd reactions. `initial` = the moment the event starts. */
export function crowdReact(sim: Sim, ev: WorldEvent, initial: boolean) {
  const r = sim.rand;
  const p = ev.place;
  for (const a of sim.walkers) {
    if (a.state === "inside" && ev.crowd !== "go_home") continue;
    if (a.eventId === ev.id) continue;
    const d = p ? Math.hypot(a.x - p.x, a.z - p.z) : 0;
    const reach = p ? Math.max(ev.radius * 3, 260) : Infinity;
    if (d > reach) continue;
    // later sweeps only nudge a few passers-by
    if (!initial && !r.chance(0.15)) continue;
    let trip: Trip | null = null;
    switch (ev.crowd) {
      case "gather":
      case "celebrate":
        if (ev.kind === "fire" && d < ev.radius * 0.6) trip = awayTrip(sim, ev, a);
        else if (r.chance(curiosity(a) * (0.5 + ev.intensity * 0.6))) trip = watchTrip(sim, ev, a);
        if (ev.crowd === "celebrate" && trip) a.flag = r.chance(0.6);
        break;
      case "flee":
        if (d < ev.radius * 1.3) trip = awayTrip(sim, ev, a);
        break;
      case "avoid":
        if (d < ev.radius) trip = awayTrip(sim, ev, a);
        break;
      case "shelter":
        if (a.state !== "inside" && r.chance(0.3)) trip = { node: a.home.node, x: a.home.x, z: a.home.z, label: "shelter", then: "inside", dwell: Math.max(10, ev.end - sim.clock.minutes) };
        else a.umbrella = r.chance(0.75);
        break;
      case "go_home":
        if (a.state !== "inside") trip = { node: a.home.node, x: a.home.x, z: a.home.z, label: "home", then: "inside", dwell: Math.max(10, ev.end - sim.clock.minutes) };
        else a.until = Math.max(a.until, ev.end);
        break;
    }
    if (trip && sim.send(a, trip)) a.eventId = ev.kind === "rain" || ev.kind === "storm" || ev.kind === "quiet" ? undefined : ev.id;
  }
}

/** While a gather-type event runs, some new errands become "go and look". */
export function eventOverride(sim: Sim, a: Agent): Trip | null {
  if (a.kind !== "walker") return null;
  for (const ev of sim.events) {
    if (ev.ended || !ev.place) continue;
    if (ev.crowd !== "gather" && ev.crowd !== "celebrate") continue;
    const d = Math.hypot(a.x - ev.place.x, a.z - ev.place.z);
    if (d < Math.max(ev.radius * 3, 260) && sim.rand.chance(curiosity(a) * 0.35)) return watchTrip(sim, ev, a);
  }
  return null;
}
