// Bake raw Overpass dumps (data/*.json) into one compact, projected world file
// (public/data/pho-co.json). Run once: `npm run bake`. Data © OpenStreetMap
// contributors, ODbL — the attribution ships inside the baked file and the UI.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")).elements;

// --- projection: local metres around the centre of the bbox, x = east, z = south
const BBOX = { s: 21.0265, w: 105.8400, n: 21.0405, e: 105.8565 };
const LAT0 = (BBOX.s + BBOX.n) / 2;
const LON0 = (BBOX.w + BBOX.e) / 2;
const phi = (LAT0 * Math.PI) / 180;
const M_LAT = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const M_LON = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
const r1 = (v) => Math.round(v * 10) / 10;
const proj = (lat, lon) => [r1((lon - LON0) * M_LON), r1(-(lat - LAT0) * M_LAT)];
const HALF = { x: ((BBOX.e - BBOX.w) / 2) * M_LON, z: ((BBOX.n - BBOX.s) / 2) * M_LAT };
const inside = ([x, z], m = 0) => Math.abs(x) <= HALF.x + m && Math.abs(z) <= HALF.z + m;

// deterministic hash → [0,1)
function hash(n) {
  let h = Number(BigInt.asUintN(32, BigInt(n) * 2654435761n));
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function ringArea(r) {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, z1] = r[i];
    const [x2, z2] = r[(i + 1) % r.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}
function centroid(r) {
  let x = 0, z = 0;
  for (const p of r) { x += p[0]; z += p[1]; }
  return [r1(x / r.length), r1(z / r.length)];
}
function cleanRing(geom) {
  const r = geom.map((g) => proj(g.lat, g.lon));
  if (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  // drop consecutive duplicates
  return r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
}
// Stitch multipolygon member ways into closed rings.
function stitch(members) {
  const segs = members.map((m) => m.geometry.map((g) => [g.lat, g.lon]));
  const rings = [];
  const key = (p) => p.join(",");
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (key(ring[0]) !== key(ring.at(-1)) && guard++ < 500) {
      const i = segs.findIndex((s) => key(s[0]) === key(ring.at(-1)) || key(s.at(-1)) === key(ring.at(-1)));
      if (i < 0) break;
      const s = segs.splice(i, 1)[0];
      ring = ring.concat(key(s[0]) === key(ring.at(-1)) ? s.slice(1) : s.reverse().slice(1));
    }
    rings.push(cleanRing(ring.map(([lat, lon]) => ({ lat, lon }))));
  }
  return rings;
}

// ---------------------------------------------------------------- buildings
const WALL = ["#f2c14e", "#f4d58d", "#efe6d2", "#e9dcc0", "#f3e3b5", "#e8c9a8", "#d9e3dc", "#f1d1c6", "#ece8e1", "#e6b86a", "#cfd8cf"];
const buildings = [];
for (const b of read("buildings.json")) {
  if (!b.geometry) continue;
  const ring = cleanRing(b.geometry);
  if (ring.length < 3 || !inside(ring[0], 40)) continue;
  const area = Math.abs(ringArea(ring));
  if (area < 6) continue;
  const t = b.tags ?? {};
  const u = hash(b.id);
  let levels = Number.parseFloat(t["building:levels"]);
  if (!Number.isFinite(levels)) {
    if (t.building === "roof") levels = 1;
    else if (["hospital", "hotel", "office", "government", "apartments"].includes(t.building) || area > 900) levels = 4 + Math.floor(u * 5);
    else if (area > 300) levels = 3 + Math.floor(u * 3);
    else levels = u < 0.18 ? 2 : u < 0.55 ? 3 : u < 0.86 ? 4 : 5; // tube houses
  }
  const h = Number.parseFloat(t.height);
  const height = r1(Number.isFinite(h) ? h : levels * 3.3 + (t.building === "roof" ? 0 : 0.6));
  buildings.push({
    r: ring.flat(),
    h: height,
    c: WALL[Math.floor(hash(b.id + 7) * WALL.length)],
    k: t.building === "roof" ? "roof" : levels <= 2 && hash(b.id + 3) < 0.6 ? "tile" : "flat",
  });
}

// ---------------------------------------------------------------- street graph
const WIDTH = { primary: 12, primary_link: 8, secondary: 10, secondary_link: 8, tertiary: 8, residential: 6, living_street: 5, service: 4, pedestrian: 6, footway: 2.6, path: 2, steps: 2.4 };
const WALK_ONLY = new Set(["footway", "path", "steps", "pedestrian"]);
const nodeIndex = new Map();
const nodes = [];
const ways = [];
const edges = []; // [a, b, drivable]
const getNode = (id, lat, lon) => {
  if (!nodeIndex.has(id)) {
    nodeIndex.set(id, nodes.length / 2);
    nodes.push(...proj(lat, lon));
  }
  return nodeIndex.get(id);
};
for (const w of read("highways.json")) {
  const kind = w.tags.highway;
  if (!(kind in WIDTH) || !w.geometry) continue;
  if (w.tags.area === "yes") continue;
  let run = [];
  const flush = () => {
    if (run.length >= 2) {
      const drive = !WALK_ONLY.has(kind) && w.tags.motor_vehicle !== "no" && w.tags.access !== "no";
      ways.push({ n: w.tags["name:vi"] ?? w.tags.name ?? "", k: kind, w: WIDTH[kind], b: w.tags.bridge ? 1 : 0, p: run });
      for (let i = 1; i < run.length; i++) edges.push([run[i - 1], run[i], drive ? 1 : 0]);
    }
    run = [];
  };
  w.nodes.forEach((id, i) => {
    const g = w.geometry[i];
    if (!g) return flush();
    const p = proj(g.lat, g.lon);
    if (!inside(p, 80)) return flush();
    run.push(getNode(id, g.lat, g.lon));
  });
  flush();
}

// keep only the largest walkable component, re-index
const N = nodes.length / 2;
const adj = Array.from({ length: N }, () => []);
for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
const comp = new Int32Array(N).fill(-1);
let best = -1, bestSize = 0;
for (let s = 0, c = 0; s < N; s++) {
  if (comp[s] >= 0) continue;
  const stack = [s]; comp[s] = c; let size = 0;
  while (stack.length) { const u = stack.pop(); size++; for (const v of adj[u]) if (comp[v] < 0) { comp[v] = c; stack.push(v); } }
  if (size > bestSize) { bestSize = size; best = c; }
  c++;
}
const remap = new Int32Array(N).fill(-1);
const nodes2 = [];
for (let i = 0; i < N; i++) if (comp[i] === best) { remap[i] = nodes2.length / 2; nodes2.push(nodes[2 * i], nodes[2 * i + 1]); }
const edges2 = edges.filter(([a]) => comp[a] === best).map(([a, b, d]) => [remap[a], remap[b], d]).flat();
const ways2 = ways.filter((w) => comp[w.p[0]] === best).map((w) => ({ ...w, p: w.p.map((i) => remap[i]) }));

// spatial nearest-node helper for snapping
const M = nodes2.length / 2;
const nearestNode = (x, z) => {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < M; i++) {
    const dx = nodes2[2 * i] - x, dz = nodes2[2 * i + 1] - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
};

// ---------------------------------------------------------------- areas
const water = [];
const green = [];
const rails = [];
const areaPois = [];
for (const a of read("areas.json")) {
  const t = a.tags ?? {};
  if (t.railway === "rail" && a.geometry) {
    rails.push(a.geometry.map((g) => proj(g.lat, g.lon)).filter((p) => inside(p, 120)).flat());
    continue;
  }
  let rings;
  if (a.type === "relation") {
    const outer = stitch(a.members.filter((m) => m.role === "outer" && m.geometry));
    const inner = stitch(a.members.filter((m) => m.role === "inner" && m.geometry));
    rings = outer.map((o) => ({ o, i: inner }));
  } else if (a.geometry) {
    rings = [{ o: cleanRing(a.geometry), i: [] }];
  } else continue;
  for (const { o, i } of rings) {
    if (o.length < 3) continue;
    if (t.natural === "water") water.push({ n: t["name:vi"] ?? t.name ?? "", o: o.flat(), i: i.filter((r) => r.length >= 3).map((r) => r.flat()) });
    else if (["park", "garden"].includes(t.leisure) || ["grass", "recreation_ground"].includes(t.landuse)) green.push(o.flat());
    else if (t.name && inside(o[0], 0)) areaPois.push({ tags: t, c: centroid(o) });
  }
}

// ---------------------------------------------------------------- POIs
function category(t) {
  const a = t.amenity, s = t.shop;
  if (t.natural === "tree") return null;
  if (/^chợ/i.test(t.name ?? "") || a === "marketplace") return ["market", "chợ"];
  if (a === "place_of_worship" || t.historic) return ["temple", t.historic ?? t.religion ?? "đền"];
  if (["restaurant", "fast_food", "food_court"].includes(a)) return ["food", t.cuisine ?? a];
  if (["cafe", "ice_cream"].includes(a) || s === "coffee" || s === "tea") return ["cafe", a ?? s];
  if (["bar", "pub", "nightclub"].includes(a)) return ["bar", a];
  if (["bakery", "confectionery", "convenience", "supermarket", "beverages", "greengrocer", "butcher", "seafood"].includes(s)) return ["grocery", s];
  if (s) return ["shop", s];
  if (["hotel", "hostel", "guest_house"].includes(t.tourism)) return ["lodging", t.tourism];
  if (["attraction", "viewpoint", "museum", "artwork", "gallery"].includes(t.tourism)) return ["sight", t.tourism];
  if (["school", "kindergarten", "college", "university"].includes(a)) return ["school", a];
  if (["hospital", "clinic", "doctors", "pharmacy", "dentist"].includes(a)) return ["health", a];
  if (["bank", "atm", "bureau_de_change"].includes(a)) return ["bank", a];
  if (["police", "fire_station", "townhall", "courthouse"].includes(a) || t.office === "government") return ["civic", a ?? "office"];
  if (["theatre", "cinema", "arts_centre"].includes(a)) return ["culture", a];
  if (t.craft) return ["craft", t.craft];
  if (t.office) return ["office", t.office];
  return null;
}
const pois = [];
const trees = [];
for (const p of read("pois.json")) {
  const t = p.tags ?? {};
  const xz = proj(p.lat, p.lon);
  if (!inside(xz, 0)) continue;
  if (t.natural === "tree") { trees.push(...xz); continue; }
  const c = category(t);
  if (!c) continue;
  // unnamed ATMs/benches are noise for agents
  if (!t.name && ["bank"].includes(c[0])) continue;
  pois.push({ n: t["name:vi"] ?? t.name ?? "", c: c[0], s: String(c[1]), x: xz[0], z: xz[1] });
}
for (const { tags: t, c: xz } of areaPois) {
  const c = category(t);
  if (c) pois.push({ n: t["name:vi"] ?? t.name, c: c[0], s: String(c[1]), x: xz[0], z: xz[1], big: 1 });
}
for (const p of pois) p.node = nearestNode(p.x, p.z);

// homes: plain small buildings, snapped to the street network
const homes = [];
buildings.forEach((b, i) => {
  if (b.k === "roof") return;
  const ring = [];
  for (let j = 0; j < b.r.length; j += 2) ring.push([b.r[j], b.r[j + 1]]);
  const a = Math.abs(ringArea(ring));
  if (a < 25 || a > 260 || !inside(ring[0], 0)) return;
  if (hash(i * 31 + 5) > 0.35) return;
  const [x, z] = centroid(ring);
  homes.push(x, z, nearestNode(x, z));
});

const out = {
  meta: {
    name: "Phố cổ Hà Nội",
    bbox: BBOX,
    origin: { lat: LAT0, lon: LON0 },
    half: { x: r1(HALF.x), z: r1(HALF.z) },
    attribution: "© OpenStreetMap contributors (ODbL 1.0) — openstreetmap.org/copyright",
    baked: new Date().toISOString().slice(0, 10),
  },
  buildings,
  nodes: nodes2,
  edges: edges2,
  ways: ways2,
  water,
  green,
  rails: rails.filter((r) => r.length >= 4),
  trees,
  pois,
  homes,
};
fs.mkdirSync(path.join(ROOT, "public/data"), { recursive: true });
const file = path.join(ROOT, "public/data/pho-co.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log({
  buildings: buildings.length,
  nodes: nodes2.length / 2,
  edges: edges2.length / 3,
  ways: ways2.length,
  water: water.length,
  green: green.length,
  rails: rails.length,
  trees: trees.length / 2,
  pois: pois.length,
  homes: homes.length / 3,
  kb: Math.round(fs.statSync(file).size / 1024),
});
