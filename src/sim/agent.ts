import type { World } from "../world/world";
import type { ErrandKey } from "./core";
import { findPath, type Restrictions } from "./path";

export type AgentKind = "walker" | "bike" | "resident" | "actor";
export type ActorType =
  | "firetruck" | "firefighter" | "police" | "ambulance" | "lion" | "drummer" | "marcher"
  | "buffalo" | "dog" | "chicken" | "train" | "camera" | "performer";

export type Then = "inside" | "idle" | "watch" | "despawn" | "next";

export interface Trip {
  node: number;
  /** optional final point off the graph (a shop door, a spot on the lake shore) */
  x?: number;
  z?: number;
  label: string;
  then: Then;
  /** sim minutes to stay after arriving */
  dwell: number;
  /** look-at point while watching */
  lookX?: number;
  lookZ?: number;
}

export interface Agent {
  id: number;
  kind: AgentKind;
  actor?: ActorType;
  name: string;
  female: boolean;
  age: number;
  role: "local" | "tourist" | "vendor" | "student" | "rider" | "resident" | "actor";
  errand: ErrandKey | string;
  /** rendered position (smoothed) */
  x: number;
  z: number;
  /** position on the path incl. lateral offset (smoothing target) */
  tx: number;
  tz: number;
  heading: number;
  speed: number;
  path: number[] | null;
  pi: number;
  seg: number;
  /** pedestrians: which pavement (-1/+1); bikes: lane jitter */
  side: number;
  state: "move" | "idle" | "inside" | "watch" | "off";
  until: number;
  trip: Trip | null;
  home: { node: number; x: number; z: number };
  color: number;
  hat: 0 | 1 | 2;
  umbrella: boolean;
  flag: boolean;
  light: boolean;
  scale: number;
  /** owning event, for actors and crowd reactions */
  eventId?: string;
  /** walk phase for bobbing */
  phase: number;
  /** final straight leg to trip.x/z after the last node */
  approach: boolean;
}

let nextId = 1;
export function makeAgent(p: Partial<Agent> & Pick<Agent, "kind" | "name" | "home">): Agent {
  const a: Agent = {
    id: nextId++,
    female: false,
    age: 30,
    role: "local",
    errand: "wander",
    x: p.home.x,
    z: p.home.z,
    tx: p.home.x,
    tz: p.home.z,
    heading: 0,
    speed: 3,
    path: null,
    pi: 0,
    seg: 0,
    side: 1,
    state: "inside",
    until: 0,
    trip: null,
    color: 0x888888,
    hat: 0,
    umbrella: false,
    flag: false,
    light: false,
    scale: 1,
    phase: Math.random() * 10,
    approach: false,
    ...p,
  };
  return a;
}

/** Start walking/driving to a trip. Returns false when no route exists. */
export function startTrip(world: World, a: Agent, from: number, trip: Trip, rx?: Restrictions): boolean {
  const drive = a.kind === "bike" || a.actor === "firetruck" || a.actor === "police" || a.actor === "ambulance";
  const path = findPath(world, from, trip.node, drive, rx);
  if (!path) return false;
  a.path = path;
  a.pi = 0;
  a.seg = 0;
  a.trip = trip;
  a.state = "move";
  a.approach = false;
  a.errand = trip.label;
  if (a.kind === "walker" || a.kind === "resident") a.side = Math.random() < 0.5 ? -1 : 1;
  return true;
}

function edgeBetween(world: World, a: number, b: number) {
  for (const e of world.adj[a]) if (e.to === b) return e;
  return null;
}

/**
 * Advance one agent along its path by `dt` visual seconds. Returns true on
 * the frame it arrives.
 */
export function moveAgent(world: World, a: Agent, dt: number, rx: Restrictions, speedMul = 1): boolean {
  if (a.state !== "move" || !a.path) return false;
  const path = a.path;
  const isBike = a.kind === "bike" || a.actor === "firetruck" || a.actor === "police" || a.actor === "ambulance";

  if (a.approach && a.trip?.x !== undefined && a.trip.z !== undefined) {
    const dx = a.trip.x - a.tx, dz = a.trip.z - a.tz;
    const d = Math.hypot(dx, dz);
    const step = a.speed * speedMul * dt;
    if (d <= step) {
      a.tx = a.trip.x;
      a.tz = a.trip.z;
      a.approach = false;
      return true;
    }
    a.tx += (dx / d) * step;
    a.tz += (dz / d) * step;
    a.heading = Math.atan2(dx, dz);
    return false;
  }

  let remaining = a.speed * speedMul * dt;
  let width = 6;
  while (a.pi < path.length - 1) {
    const n0 = path[a.pi], n1 = path[a.pi + 1];
    const e = edgeBetween(world, n0, n1);
    const len = e?.len ?? Math.hypot(world.nx[n1] - world.nx[n0], world.nz[n1] - world.nz[n0]);
    if (e && e.way >= 0) {
      width = world.data.ways[e.way].w;
      const slow = isBike ? rx.slow.get(e.way) : undefined;
      if (slow && remaining === a.speed * speedMul * dt) remaining *= slow;
    }
    const left = len - a.seg;
    if (remaining < left) {
      a.seg += remaining;
      remaining = 0;
      break;
    }
    remaining -= left;
    a.pi++;
    a.seg = 0;
  }

  const last = a.pi >= path.length - 1;
  const i0 = path[Math.min(a.pi, path.length - 1)];
  const i1 = path[Math.min(a.pi + 1, path.length - 1)];
  let dx = world.nx[i1] - world.nx[i0], dz = world.nz[i1] - world.nz[i0];
  let len = Math.hypot(dx, dz);
  if (len < 1e-3 && a.pi > 0) {
    const ip = path[a.pi - 1];
    dx = world.nx[i0] - world.nx[ip];
    dz = world.nz[i0] - world.nz[ip];
    len = Math.hypot(dx, dz) || 1;
  }
  const t = last ? 0 : Math.min(1, a.seg / (len || 1));
  const px = world.nx[i0] + dx * t, pz = world.nz[i0] + dz * t;
  // right-hand normal (x east, z south): (-dz, dx)
  const rx_ = len > 0 ? -dz / len : 0, rz_ = len > 0 ? dx / len : 0;
  let off: number;
  if (isBike) off = width * 0.22 + a.side * 0.6;
  else if (a.kind === "actor" && a.actor !== "firefighter") off = 0;
  // Old Quarter houses sit on the street line and pavements are full of parked bikes,
  // so people walk the road edge — which also keeps them out of building footprints.
  else off = width > 3.5 ? a.side * Math.max(1, width / 2 - 0.7) : a.side * 0.4;
  a.tx = px + rx_ * off;
  a.tz = pz + rz_ * off;
  if (len > 1e-3) a.heading = Math.atan2(dx, dz);

  if (last) {
    if (a.trip?.x !== undefined && a.trip.z !== undefined && Math.hypot(a.trip.x - a.tx, a.trip.z - a.tz) < 40) {
      a.approach = true;
      return false;
    }
    return true;
  }
  return false;
}

/** Ease the rendered position toward the path target. */
export function smooth(a: Agent, dt: number) {
  const k = 1 - Math.exp(-dt * 7);
  a.x += (a.tx - a.x) * k;
  a.z += (a.tz - a.z) * k;
}

/** Teleport (used when spawning a bike at the map edge, or an actor). */
export function place(a: Agent, x: number, z: number) {
  a.x = a.tx = x;
  a.z = a.tz = z;
}
