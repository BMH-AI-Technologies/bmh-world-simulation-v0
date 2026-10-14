// The baked Old Quarter (public/data/pho-co.json) plus the indexes the sim
// needs: adjacency, a spatial grid for "nearest node", and name lookups.

export interface BakedBuilding {
  /** flat [x0,z0,x1,z1,...] footprint ring */
  r: number[];
  h: number;
  c: string;
  k: "flat" | "tile" | "roof";
}
export interface BakedWay {
  n: string;
  k: string;
  w: number;
  b: 0 | 1;
  p: number[];
}
export interface BakedPoi {
  n: string;
  c: PoiCategory;
  s: string;
  x: number;
  z: number;
  node: number;
  big?: 1;
}
export type PoiCategory =
  | "market" | "temple" | "food" | "cafe" | "bar" | "grocery" | "shop" | "lodging" | "sight"
  | "school" | "health" | "bank" | "civic" | "culture" | "craft" | "office";

export interface BakedWorld {
  meta: { name: string; half: { x: number; z: number }; attribution: string; baked: string };
  buildings: BakedBuilding[];
  nodes: number[];
  /** flat [a, b, drivable, ...] */
  edges: number[];
  ways: BakedWay[];
  water: { n: string; o: number[]; i: number[][] }[];
  green: number[][];
  rails: number[][];
  trees: number[];
  pois: BakedPoi[];
  /** flat [x, z, node, ...] */
  homes: number[];
}

export interface Edge {
  to: number;
  len: number;
  drive: boolean;
  /** index into ways[] — for street-name lookups and per-street effects */
  way: number;
}

export interface Place {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  node: number;
}

/** Strip Vietnamese diacritics + case for fuzzy name matching. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export class World {
  readonly nodeCount: number;
  readonly nx: Float32Array;
  readonly nz: Float32Array;
  readonly adj: Edge[][];
  /** nodes that touch at least one drivable edge */
  readonly driveNodes: number[];
  /** street name → node indices along it (folded name as key) */
  readonly streets = new Map<string, { name: string; nodes: number[]; ways: number[] }>();
  /** well-known landmarks used by residents, the director and labels */
  readonly landmarks: Place[] = [];
  /** walkable nodes along the Hồ Gươm shore */
  readonly lakeNodes: number[] = [];
  /** centre of the lake water, for the label */
  lakeCenter: { x: number; z: number } | null = null;
  private grid = new Map<number, number[]>();
  private readonly cell = 40;

  constructor(readonly data: BakedWorld) {
    const n = data.nodes.length / 2;
    this.nodeCount = n;
    this.nx = new Float32Array(n);
    this.nz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.nx[i] = data.nodes[2 * i];
      this.nz[i] = data.nodes[2 * i + 1];
      const k = this.key(this.nx[i], this.nz[i]);
      const bucket = this.grid.get(k);
      if (bucket) bucket.push(i);
      else this.grid.set(k, [i]);
    }
    this.adj = Array.from({ length: n }, () => []);
    // way index per edge: walk ways in order, they produced edges in order
    const wayOfPair = new Map<string, number>();
    data.ways.forEach((w, wi) => {
      for (let i = 1; i < w.p.length; i++) wayOfPair.set(`${w.p[i - 1]}:${w.p[i]}`, wi);
    });
    const isDrive = new Uint8Array(n);
    for (let i = 0; i < data.edges.length; i += 3) {
      const a = data.edges[i], b = data.edges[i + 1], drive = data.edges[i + 2] === 1;
      const len = Math.hypot(this.nx[a] - this.nx[b], this.nz[a] - this.nz[b]);
      if (len < 0.01) continue;
      const way = wayOfPair.get(`${a}:${b}`) ?? -1;
      this.adj[a].push({ to: b, len, drive, way });
      this.adj[b].push({ to: a, len, drive, way });
      if (drive) isDrive[a] = isDrive[b] = 1;
    }
    this.driveNodes = [];
    for (let i = 0; i < n; i++) if (isDrive[i]) this.driveNodes.push(i);

    data.ways.forEach((w, wi) => {
      if (!w.n) return;
      const key = fold(w.n).replace(/^(pho|duong|ngo|ngach|cau|vong xoay)\s+/, "");
      const s = this.streets.get(key) ?? { name: w.n, nodes: [], ways: [] };
      s.nodes.push(...w.p);
      s.ways.push(wi);
      this.streets.set(key, s);
    });

    const pick = (pattern: RegExp, kind: string, rename?: string) => {
      const p = data.pois.find((q) => pattern.test(q.n));
      if (p) this.landmarks.push({ id: `lm:${this.landmarks.length}`, name: rename ?? p.n, kind, x: p.x, z: p.z, node: p.node });
    };
    pick(/^Tháp Rùa$/, "sight");
    pick(/^Đền Ngọc Sơn$/, "temple");
    pick(/^Chợ Đồng Xuân$/, "market");
    pick(/^Ô Quan Chưởng$/, "sight");
    pick(/^Nhà thờ Lớn$/, "temple");
    pick(/^Đền Bạch Mã$/, "temple");
    pick(/^Tượng đài Lý Thái Tổ$/, "sight");
    pick(/^Nhà hát Múa rối nước Thăng Long$/, "culture");
    pick(/^Phố đường tàu/, "sight", "Phố đường tàu");
    pick(/^Phố Tạ Hiện$/, "bar", "Phố bia Tạ Hiện");
    pick(/^Chợ Đêm Hàng Đào/, "market", "Chợ đêm Hàng Đào");
    pick(/^Tháp nước Hàng Đậu$/, "sight");
    pick(/^Đình Kim Ngân$/, "temple");
    pick(/^Nhà 48 phố Hàng Ngang$/, "sight");
    // Lake shore as one landmark: the water ring centroid, snapped to the nearest walkable node.
    const lake = data.water.find((w) => /Hoàn Kiếm/.test(w.n));
    if (lake) {
      let x = 0, z = 0;
      const m = lake.o.length / 2;
      for (let i = 0; i < lake.o.length; i += 2) { x += lake.o[i]; z += lake.o[i + 1]; }
      x /= m; z /= m;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < lake.o.length; j += 2) {
          if ((this.nx[i] - lake.o[j]) ** 2 + (this.nz[i] - lake.o[j + 1]) ** 2 < 30 * 30) {
            this.lakeNodes.push(i);
            break;
          }
        }
      }
      this.lakeCenter = { x, z };
      // Events "at Hồ Gươm" happen on the shore at Bờ Hồ (north end), not in the water.
      let ni = 0;
      for (let j = 2; j < lake.o.length; j += 2) if (lake.o[j + 1] < lake.o[ni + 1]) ni = j;
      let node = this.nearestNode(lake.o[ni], lake.o[ni + 1]);
      if (this.lakeNodes.length) {
        node = this.lakeNodes.reduce((b, i) => ((this.nx[i] - lake.o[ni]) ** 2 + (this.nz[i] - lake.o[ni + 1]) ** 2 < (this.nx[b] - lake.o[ni]) ** 2 + (this.nz[b] - lake.o[ni + 1]) ** 2 ? i : b), this.lakeNodes[0]);
      }
      this.landmarks.unshift({ id: "lm:lake", name: "Hồ Gươm", kind: "lake", x: this.nx[node], z: this.nz[node], node });
    }
  }

  private key(x: number, z: number) {
    return Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell);
  }

  /** Nearest graph node; `driveOnly` restricts to nodes on drivable streets. */
  nearestNode(x: number, z: number, driveOnly = false): number {
    let best = -1, bd = Infinity;
    for (let ring = 0; ring < 30; ring++) {
      const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const b = this.grid.get((cx + dx) * 100003 + (cz + dz));
          if (!b) continue;
          for (const i of b) {
            if (driveOnly && !this.adj[i].some((e) => e.drive)) continue;
            const d = (this.nx[i] - x) ** 2 + (this.nz[i] - z) ** 2;
            if (d < bd) { bd = d; best = i; }
          }
        }
      }
      // anything found within this ring is provably nearest after one more ring
      if (best >= 0 && ring > 0 && Math.sqrt(bd) < ring * this.cell) break;
    }
    return best;
  }

  nodesWithin(x: number, z: number, r: number): number[] {
    const out: number[] = [];
    const c = Math.ceil(r / this.cell);
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let dx = -c; dx <= c; dx++)
      for (let dz = -c; dz <= c; dz++)
        for (const i of this.grid.get((cx + dx) * 100003 + (cz + dz)) ?? [])
          if ((this.nx[i] - x) ** 2 + (this.nz[i] - z) ** 2 <= r * r) out.push(i);
    return out;
  }

  /**
   * Resolve a free-text place ("Hàng Bạc", "hồ gươm", "Chợ Đồng Xuân") to a
   * point. Landmarks first, then streets, then any named POI.
   */
  resolvePlace(text: string): { name: string; x: number; z: number; node: number; street?: string } | null {
    const q = fold(text).replace(/^(pho|duong|ngo|o|tai|khu|quanh|gan)\s+/, "");
    if (!q) return null;
    const lm = this.landmarks.find((l) => fold(l.name) === q || fold(l.name).includes(q) || (q.length > 4 && q.includes(fold(l.name))));
    if (lm) return { name: lm.name, x: lm.x, z: lm.z, node: lm.node };
    if (/ho guom|ho hoan kiem|bo ho/.test(q) && this.landmarks[0]?.kind === "lake") {
      const l = this.landmarks[0];
      return { name: l.name, x: l.x, z: l.z, node: l.node };
    }
    let street = this.streets.get(q);
    if (!street) {
      for (const [k, s] of this.streets) if (q.includes(k) && k.length >= 5) { street = s; break; }
    }
    if (street) {
      const mid = street.nodes[Math.floor(street.nodes.length / 2)];
      return { name: street.name, x: this.nx[mid], z: this.nz[mid], node: mid, street: street.name };
    }
    const poi = this.data.pois.find((p) => p.n && (fold(p.n) === q || (q.length > 5 && fold(p.n).includes(q))));
    if (poi) return { name: poi.n, x: poi.x, z: poi.z, node: poi.node };
    return null;
  }

  /** Every street + landmark name, for prompts and autocomplete. */
  placeNames(): string[] {
    return [...this.landmarks.map((l) => l.name), ...[...this.streets.values()].map((s) => s.name).filter((n) => /^(Phố|Đường|Ngõ)/.test(n))];
  }

  poisOf(cat: string): BakedPoi[] {
    return this.data.pois.filter((p) => p.c === cat);
  }
}

export async function loadWorld(url = `${import.meta.env.BASE_URL}data/pho-co.json`): Promise<World> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được bản đồ (${res.status})`);
  return new World((await res.json()) as BakedWorld);
}
