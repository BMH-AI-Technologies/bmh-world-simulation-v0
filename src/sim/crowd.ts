import type { BakedPoi, World } from "../world/world";
import { makeAgent, place, startTrip, type Agent, type Trip } from "./agent";
import { personName, type ErrandKey, type Rng } from "./core";
import type { Restrictions } from "./path";

const SHIRTS = [0xe63946, 0x457b9d, 0xf1faee, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0x264653, 0x8d99ae, 0xffb4a2, 0x6d6875, 0x3a86ff, 0xfb5607, 0x8338ec, 0xffffff, 0x222222];
const BIKES = [0xc1121f, 0x1d3557, 0xe5e5e5, 0x111111, 0x6c757d, 0x2b9348, 0xf2c14e, 0x5e60ce];

export interface CrowdCtx {
  world: World;
  rand: Rng;
  rx: Restrictions;
  hour: number;
  weekend: boolean;
  minutes: number;
  /** extra pull toward a point (events with "gather"); returned trip wins if non-null */
  override?: (a: Agent) => Trip | null;
}

/** Fraction of each role that should be out on the street at a given hour. */
export function activity(role: Agent["role"], hour: number, weekend: boolean): number {
  const h = hour;
  switch (role) {
    case "tourist":
      return h < 6.5 ? 0.03 : h < 9 ? 0.45 : h < 22 ? 0.8 : h < 24 ? 0.4 : 0.05;
    case "vendor":
      return h < 4.5 ? 0 : h < 19 ? 0.85 : h < 22 ? 0.4 : 0;
    case "student":
      return h < 6.5 ? 0 : h < 11.5 ? 0.6 : h < 13 ? 0.5 : h < 17.5 ? 0.6 : h < 21 ? 0.5 : 0.05;
    default:
      if (h < 4.5) return 0.03;
      if (h < 7) return 0.5; // dawn exercise
      if (h < 11) return 0.4;
      if (h < 13.5) return 0.55;
      if (h < 17) return 0.35;
      if (h < 22) return weekend ? 0.85 : 0.7;
      if (h < 24) return weekend ? 0.45 : 0.25;
      return 0.05;
  }
}

/** Bikes on the road, as a fraction of the fleet. Rush hours peak. */
export function traffic(hour: number): number {
  const h = hour;
  if (h < 5) return 0.05;
  if (h < 7) return 0.35;
  if (h < 9) return 1;
  if (h < 11) return 0.6;
  if (h < 13.5) return 0.75;
  if (h < 16.5) return 0.6;
  if (h < 19) return 1;
  if (h < 22) return 0.7;
  return 0.25;
}

export function createWalkers(world: World, r: Rng, count: number): Agent[] {
  const homes = world.data.homes;
  const lodging = world.poisOf("lodging");
  const out: Agent[] = [];
  for (let i = 0; i < count; i++) {
    const u = r.next();
    const role: Agent["role"] = u < 0.26 ? "tourist" : u < 0.34 ? "vendor" : u < 0.44 ? "student" : "local";
    let home: Agent["home"];
    if (role === "tourist" && lodging.length) {
      const l = r.pick(lodging);
      home = { node: l.node, x: l.x, z: l.z };
    } else {
      const h = r.int(0, homes.length / 3 - 1);
      home = { x: homes[3 * h], z: homes[3 * h + 1], node: homes[3 * h + 2] };
    }
    const who = personName(r, role === "tourist");
    const age = role === "student" ? r.int(9, 20) : who.age;
    const a = makeAgent({
      kind: "walker",
      role,
      name: who.name,
      female: who.female,
      age,
      home,
      color: r.pick(SHIRTS),
      hat: role === "vendor" ? 1 : role === "tourist" ? (r.chance(0.3) ? 2 : 0) : who.female && age > 40 && r.chance(0.35) ? 1 : 0,
      speed: role === "vendor" ? r.range(1.8, 2.3) : age > 65 ? r.range(2, 2.5) : r.range(2.6, 3.4),
      scale: age < 14 ? 0.72 : r.range(0.93, 1.07),
      state: "inside",
      until: r.range(0, 60),
    });
    out.push(a);
  }
  return out;
}

export function createBikes(world: World, r: Rng, count: number): Agent[] {
  const out: Agent[] = [];
  for (let i = 0; i < count; i++) {
    const node = r.pick(world.driveNodes);
    const a = makeAgent({
      kind: "bike",
      role: "rider",
      name: personName(r, false).name,
      home: { node, x: world.nx[node], z: world.nz[node] },
      color: r.pick(BIKES),
      hat: 2, // helmet
      speed: r.range(6.5, 9.5),
      side: r.range(-1, 1),
      state: "off",
      until: r.range(0, 30),
    });
    out.push(a);
  }
  return out;
}

const near = (world: World, pois: BakedPoi[], x: number, z: number, r: Rng, maxD = 450) => {
  const cands = pois.filter((p) => Math.abs(p.x - x) < maxD && Math.abs(p.z - z) < maxD);
  return cands.length ? r.pick(cands) : pois.length ? r.pick(pois) : null;
};

/** Pick the next errand for an extra from its role and the hour. */
export function nextTrip(a: Agent, c: CrowdCtx): Trip | null {
  const { world, rand: r, hour: h, weekend } = c;
  const forced = c.override?.(a);
  if (forced) return forced;

  const at = { x: a.x, z: a.z };
  const poiTrip = (cat: string | string[], label: ErrandKey, dwell: [number, number], then: Trip["then"] = "inside"): Trip | null => {
    const cats = Array.isArray(cat) ? cat : [cat];
    const pool = world.data.pois.filter((p) => cats.includes(p.c));
    const p = near(world, pool, at.x, at.z, r);
    return p ? { node: p.node, x: p.x, z: p.z, label, then, dwell: r.range(dwell[0], dwell[1]) } : null;
  };
  const lm = (name: RegExp) => world.landmarks.find((l) => name.test(l.name));
  const lakeTrip = (label: ErrandKey, dwell: [number, number]): Trip | null => {
    if (!world.lakeNodes.length) return null;
    return { node: r.pick(world.lakeNodes), label, then: "idle", dwell: r.range(dwell[0], dwell[1]) };
  };
  const home: Trip = { node: a.home.node, x: a.home.x, z: a.home.z, label: a.role === "tourist" ? "return" : "home", then: "inside", dwell: r.range(40, 160) };
  const want = activity(a.role, h, weekend);
  if (!r.chance(want)) return home;

  switch (a.role) {
    case "vendor": {
      // shoulder-pole vendors drift street to street with short stops
      const n = r.pick(world.nodesWithin(a.x, a.z, 220));
      return { node: n ?? a.home.node, label: "vend", then: "idle", dwell: r.range(5, 20) };
    }
    case "tourist": {
      if (h < 9.5) return poiTrip(["food", "cafe"], "breakfast", [25, 50]);
      if (h >= 21) return poiTrip("bar", "bar", [40, 120], "idle");
      if (h >= 18) {
        if (weekend && r.chance(0.35)) {
          const nm = lm(/Chợ đêm/);
          if (nm) return { node: nm.node, label: "nightmarket", then: "idle", dwell: r.range(20, 50) };
        }
        return r.chance(0.5) ? poiTrip("food", "dinner", [40, 80]) : lakeTrip("lake", [15, 40]);
      }
      const u = r.next();
      if (u < 0.3) return lakeTrip("lake", [15, 35]);
      if (u < 0.55) return poiTrip(["sight", "temple", "culture"], "sight", [15, 40], "idle");
      if (u < 0.75) return poiTrip("shop", "shop", [10, 30]);
      return poiTrip(["cafe", "food"], h < 14 ? "lunch" : "coffee", [25, 60]);
    }
    case "student": {
      if (!weekend && ((h >= 6.5 && h < 11) || (h >= 13 && h < 16.5))) return poiTrip("school", "school", [120, 200]);
      return r.chance(0.5) ? poiTrip("cafe", "coffee", [30, 90]) : lakeTrip("lake", [20, 50]);
    }
    default: {
      if (h >= 4.5 && h < 7) return r.chance(0.7) ? lakeTrip("exercise", [25, 60]) : poiTrip(["food", "cafe"], "breakfast", [20, 40]);
      if (h < 9.5) return poiTrip(["food", "cafe"], r.chance(0.5) ? "breakfast" : "coffee", [20, 60]);
      if (h < 11.5) return r.chance(0.5) ? poiTrip(["market", "grocery"], "market", [20, 60]) : poiTrip(["shop", "temple", "bank"], "shop", [10, 30]);
      if (h < 13.5) return poiTrip("food", "lunch", [25, 50]);
      if (h < 17) return r.chance(0.5) ? poiTrip("cafe", "coffee", [30, 90]) : poiTrip(["shop", "grocery"], "shop", [10, 30]);
      if (h < 19.5) return r.chance(0.6) ? poiTrip("food", "dinner", [30, 60]) : lakeTrip("stroll", [20, 50]);
      if (weekend && h < 23 && r.chance(0.4)) {
        const nm = lm(/Chợ đêm/);
        if (nm && r.chance(0.5)) return { node: nm.node, label: "nightmarket", then: "idle", dwell: r.range(20, 50) };
        return lakeTrip("lake", [20, 60]);
      }
      if (h < 23.5) return r.chance(0.5) ? poiTrip(["cafe", "bar"], "coffee", [30, 90], "idle") : lakeTrip("stroll", [15, 40]);
      return home;
    }
  }
}

/** Advance an extra's state machine when it is idle/inside/off. */
export function thinkWalker(a: Agent, c: CrowdCtx) {
  if (a.state === "move") return;
  if (c.minutes < a.until) return;
  const from = a.state === "inside" ? a.home.node : a.path ? a.path[a.path.length - 1] : a.home.node;
  const trip = nextTrip(a, c);
  if (!trip) {
    a.until = c.minutes + 10;
    return;
  }
  if (trip.label === "home" || trip.label === "return") {
    if (a.state === "inside") {
      // already home: stay in, check again later
      a.until = c.minutes + trip.dwell;
      return;
    }
  }
  if (a.state === "inside") {
    // step out of the door
    const n = a.trip?.node ?? a.home.node;
    place(a, a.trip?.x ?? c.world.nx[n], a.trip?.z ?? c.world.nz[n]);
  }
  if (!startTrip(c.world, a, from, trip, c.rx)) {
    a.until = c.minutes + 5;
    if (a.state !== "inside") a.state = "idle";
  }
}

export function thinkBike(a: Agent, c: CrowdCtx, wanted: number, active: number) {
  if (a.state === "move") return;
  if (c.minutes < a.until) return;
  if (active >= wanted) {
    a.until = c.minutes + c.rand.range(3, 15);
    return;
  }
  const forced = c.override?.(a);
  const { world, rand: r } = c;
  // enter from a random drivable node (often the map edge, so traffic streams in)
  const half = world.data.meta.half;
  const edgeNodes = world.driveNodes.filter((n) => Math.abs(world.nx[n]) > half.x - 60 || Math.abs(world.nz[n]) > half.z - 60);
  const from = r.chance(0.6) && edgeNodes.length ? r.pick(edgeNodes) : r.pick(world.driveNodes);
  const to = forced?.node ?? (r.chance(0.6) && edgeNodes.length ? r.pick(edgeNodes) : r.pick(world.driveNodes));
  place(a, world.nx[from], world.nz[from]);
  a.side = r.range(-1, 1);
  const ok = startTrip(world, a, from, forced ?? { node: to, label: "ride", then: "despawn", dwell: 0 }, c.rx);
  if (!ok) {
    a.state = "off";
    a.until = c.minutes + 2;
  }
}
