// Download the raw OpenStreetMap data for the Old Quarter into data/*.json
// (then run `npm run bake`). Queries are tiled and retried across Overpass
// mirrors because the public servers time out on dense areas.
// Data © OpenStreetMap contributors, ODbL 1.0.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "data");
const BBOX = { s: 21.0265, w: 105.84, n: 21.0405, e: 105.8565 };
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const UA = "bmh-world-simulation-v0 (open-source sim)";

async function overpass(q) {
  for (let round = 0; round < 3; round++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(150_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).elements;
      } catch (e) {
        console.warn(`  ${new URL(url).host}: ${e.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error("all Overpass mirrors failed");
}

/** Split the bbox into nx × ny tiles. */
function tiles(nx, ny) {
  const out = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const w = BBOX.w + ((BBOX.e - BBOX.w) * i) / nx, e = BBOX.w + ((BBOX.e - BBOX.w) * (i + 1)) / nx;
      const s = BBOX.s + ((BBOX.n - BBOX.s) * j) / ny, n = BBOX.s + ((BBOX.n - BBOX.s) * (j + 1)) / ny;
      out.push(`${s},${w},${n},${e}`);
    }
  return out;
}

const JOBS = {
  buildings: { tiles: tiles(3, 2), q: (b) => `[out:json][timeout:120];way["building"](${b});out geom;` },
  highways: { tiles: tiles(2, 1), q: (b) => `[out:json][timeout:120];way["highway"](${b});out geom;` },
  areas: { tiles: tiles(2, 1), q: (b) => `[out:json][timeout:120];(way["natural"="water"](${b});relation["natural"="water"](${b});way["leisure"~"park|garden"](${b});way["landuse"~"grass|recreation_ground"](${b});way["amenity"](${b});way["historic"](${b});way["tourism"](${b});way["railway"](${b}););out geom;` },
  pois: { tiles: tiles(2, 1), q: (b) => `[out:json][timeout:120];(node["amenity"](${b});node["shop"](${b});node["tourism"](${b});node["historic"](${b});node["natural"="tree"](${b});node["craft"](${b});node["office"](${b}););out;` },
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, job] of Object.entries(JOBS)) {
  const seen = new Map();
  for (const [i, b] of job.tiles.entries()) {
    console.log(`${name} ${i + 1}/${job.tiles.length}`);
    for (const e of await overpass(job.q(b))) seen.set(`${e.type}/${e.id}`, e);
  }
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ elements: [...seen.values()] }));
  console.log(`  → ${seen.size} elements`);
}
console.log("done — now run: npm run bake");
