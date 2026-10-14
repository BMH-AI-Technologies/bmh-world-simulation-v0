import type { World } from "../world/world";

/** Per-street conditions events can impose: closed to bikes, closed to all, or slowed. */
export interface Restrictions {
  /** way index → mode */
  closed: Map<number, "drive" | "all">;
  /** way index → speed factor (0.1 = gridlock) */
  slow: Map<number, number>;
}

export const noRestrictions = (): Restrictions => ({ closed: new Map(), slow: new Map() });

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): number {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * A* over the street graph. `drive` restricts to drivable edges. Returns the
 * node sequence from `from` to `to`, or null when unreachable under the
 * current restrictions.
 */
export function findPath(world: World, from: number, to: number, drive: boolean, rx?: Restrictions): number[] | null {
  if (from === to) return [from];
  const n = world.nodeCount;
  const g = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const tx = world.nx[to], tz = world.nz[to];
  const h = (i: number) => Math.hypot(world.nx[i] - tx, world.nz[i] - tz);
  const open = new MinHeap();
  g[from] = 0;
  open.push(h(from), from);
  while (open.size) {
    const u = open.pop();
    if (u === to) break;
    if (closed[u]) continue;
    closed[u] = 1;
    for (const e of world.adj[u]) {
      if (drive && !e.drive) continue;
      if (rx && e.way >= 0) {
        const c = rx.closed.get(e.way);
        if (c === "all" || (c === "drive" && drive)) continue;
      }
      // pedestrians prefer footways a little, bikes avoid slowed streets a lot
      let cost = e.len;
      if (rx && e.way >= 0) {
        const s = rx.slow.get(e.way);
        if (s) cost /= drive ? Math.max(s, 0.05) : 1;
      }
      if (!drive && !e.drive) cost *= 0.9;
      const ng = g[u] + cost;
      if (ng < g[e.to]) {
        g[e.to] = ng;
        prev[e.to] = u;
        open.push(ng + h(e.to), e.to);
      }
    }
  }
  if (prev[to] < 0) return null;
  const path = [to];
  for (let c = to; c !== from; ) {
    c = prev[c];
    path.push(c);
  }
  return path.reverse();
}
