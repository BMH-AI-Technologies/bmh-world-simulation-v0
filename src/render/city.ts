import * as THREE from "three";
import type { World } from "../world/world";

/**
 * Static city: ground, streets, buildings (one merged mesh with a window
 * shader), lake, greens, trees, rails, street lamps, roof water tanks and a
 * few hand-built landmarks. Everything is procedural — no model files.
 */

export interface CityUniforms {
  uNight: { value: number };
  uWet: { value: number };
  uTime: { value: number };
  /** up to 4 outage zones: x, z, radius, active */
  uOut: { value: THREE.Vector4[] };
}

export function cityUniforms(): CityUniforms {
  return {
    uNight: { value: 0 },
    uWet: { value: 0 },
    uTime: { value: 0 },
    uOut: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
  };
}

const OUTAGE_GLSL = /* glsl */ `
uniform vec4 uOut[4];
float powered(vec3 p) {
  for (int i = 0; i < 4; i++) {
    if (uOut[i].w > 0.5 && distance(p.xz, uOut[i].xy) < uOut[i].z) return 0.0;
  }
  return 1.0;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

function buildingMaterial(u: CityUniforms) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aWin; // u along wall, v height, wall flag
attribute float aSeed;
varying vec3 vWin;
varying float vSeed;
varying vec3 vWPos;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
vWin = aWin; vSeed = aSeed;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uNight;
uniform float uWet;
varying vec3 vWin;
varying float vSeed;
varying vec3 vWPos;
${OUTAGE_GLSL}
float winMask; float shopMask; float litWin;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
winMask = 0.0; shopMask = 0.0; litWin = 0.0;
if (vWin.z > 0.5) {
  vec2 cell = floor(vec2(vWin.x / 2.6, vWin.y / 3.3));
  vec2 f = fract(vec2(vWin.x / 2.6, vWin.y / 3.3));
  if (cell.y < 0.5) {
    shopMask = step(0.06, f.x) * step(f.x, 0.94) * step(0.04, f.y) * step(f.y, 0.78);
  } else {
    winMask = step(0.27, f.x) * step(f.x, 0.73) * step(0.3, f.y) * step(f.y, 0.8);
  }
  float h = hash12(cell + vSeed * 17.31);
  litWin = winMask * step(h, 0.32) + shopMask * step(h, 0.8);
  vec3 glass = vec3(0.16, 0.2, 0.25);
  diffuseColor.rgb = mix(diffuseColor.rgb, glass, (winMask * 0.75 + shopMask * 0.55));
  // a little grime toward the street
  diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.0, 6.0, vWin.y);
}
diffuseColor.rgb *= 1.0 - uWet * 0.18;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float pw = powered(vWPos);
vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.86, 0.6), hash12(vec2(vSeed, floor(vWin.y / 3.3))));
totalEmissiveRadiance += warm * litWin * uNight * pw * (shopMask > 0.5 ? 0.85 : 0.5);
// phone torches / candles during outages
totalEmissiveRadiance += vec3(0.9, 0.85, 0.7) * winMask * uNight * (1.0 - pw) * step(hash12(vec2(vSeed, 3.0)), 0.08) * 0.35;`,
      );
  };
  return m;
}

/** Signed area in x/z — positive = clockwise when viewed from above (z points south). */
function signedArea(r: number[]) {
  let a = 0;
  for (let i = 0, n = r.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += r[2 * i] * r[2 * j + 1] - r[2 * j] * r[2 * i + 1];
  }
  return a / 2;
}

export function buildBuildings(world: World, u: CityUniforms) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], win: number[] = [], seed: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const roofFlat = [new THREE.Color("#8d8a84"), new THREE.Color("#a29d94"), new THREE.Color("#7b7f80"), new THREE.Color("#b5aea3")];
  const roofTile = [new THREE.Color("#a4482f"), new THREE.Color("#8f3d28"), new THREE.Color("#b5603c")];
  const tanks: number[] = [];
  world.data.buildings.forEach((b, bi) => {
    let r = b.r;
    if (signedArea(r) < 0) {
      // make winding consistent: walls face outward
      const rr: number[] = [];
      for (let i = r.length - 2; i >= 0; i -= 2) rr.push(r[i], r[i + 1]);
      r = rr;
    }
    const n = r.length / 2;
    const h = b.h;
    const s = (bi * 0.6180339) % 1;
    c.set(b.c);
    if (b.k === "roof") c.set("#6c6a66");
    // walls
    let perim = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = r[2 * i], z0 = r[2 * i + 1], x1 = r[2 * j], z1 = r[2 * j + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.05) continue;
      // outward normal for clockwise-from-above rings
      const nx = (z1 - z0) / len, nz = -(x1 - x0) / len;
      const base = pos.length / 3;
      const y0 = b.k === "roof" ? h - 0.4 : 0;
      pos.push(x0, y0, z0, x1, y0, z1, x1, h, z1, x0, h, z0);
      for (let k = 0; k < 4; k++) {
        nor.push(nx, 0, nz);
        col.push(c.r, c.g, c.b);
        seed.push(s);
      }
      const wall = b.k === "roof" ? 0 : 1;
      win.push(perim, y0, wall, perim + len, y0, wall, perim + len, h, wall, perim, h, wall);
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      perim += len;
    }
    // roof
    const contour = [];
    for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(r[2 * i], r[2 * i + 1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const rc = b.k === "tile" ? roofTile[bi % roofTile.length] : roofFlat[bi % roofFlat.length];
    const base = pos.length / 3;
    for (let i = 0; i < n; i++) {
      pos.push(r[2 * i], h, r[2 * i + 1]);
      nor.push(0, 1, 0);
      col.push(rc.r, rc.g, rc.b);
      win.push(0, 0, 0);
      seed.push(s);
    }
    for (const t of tris) {
      // front face = counter-clockwise seen from above (screen x = x, screen y = -z)
      const [a, b, cc] = t;
      const cross = (r[2 * b] - r[2 * a]) * -(r[2 * cc + 1] - r[2 * a + 1]) - -(r[2 * b + 1] - r[2 * a + 1]) * (r[2 * cc] - r[2 * a]);
      if (cross > 0) idx.push(base + a, base + b, base + cc);
      else idx.push(base + a, base + cc, base + b);
    }
    if (b.k === "flat" && h > 8 && (bi * 2654435761) % 100 < 28) {
      let cx = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += r[2 * i]; cz += r[2 * i + 1]; }
      tanks.push(cx / n + ((bi % 7) - 3) * 0.3, h, cz / n + ((bi % 5) - 2) * 0.3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aWin", new THREE.Float32BufferAttribute(win, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, buildingMaterial(u));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "buildings";

  // stainless water tanks — the Hà Nội roofline
  const tankGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.7, 10);
  tankGeo.rotateZ(Math.PI / 2);
  tankGeo.translate(0, 1.3, 0);
  const tankMat = new THREE.MeshStandardMaterial({ color: "#d8dde2", metalness: 0.85, roughness: 0.28 });
  const tanksMesh = new THREE.InstancedMesh(tankGeo, tankMat, tanks.length / 3);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < tanks.length / 3; i++) {
    m4.makeRotationY((i * 1.7) % Math.PI);
    m4.setPosition(tanks[3 * i], tanks[3 * i + 1], tanks[3 * i + 2]);
    tanksMesh.setMatrixAt(i, m4);
  }
  tanksMesh.castShadow = true;
  return { mesh, tanks: tanksMesh };
}

// ---------------------------------------------------------------- streets

function ribbon(points: number[][], width: number, y: number, out: { pos: number[]; idx: number[]; col: number[] }, color: THREE.Color, arch = 0) {
  const n = points.length;
  if (n < 2) return;
  const base = out.pos.length / 3;
  let total = 0;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push((total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])));
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const nx = -dz, nz = dx;
    const yy = y + (arch ? Math.sin((cum[i] / (total || 1)) * Math.PI) * arch : 0);
    out.pos.push(p[0] + nx * width * 0.5, yy, p[1] + nz * width * 0.5, p[0] - nx * width * 0.5, yy, p[1] - nz * width * 0.5);
    out.col.push(color.r, color.g, color.b, color.r, color.g, color.b);
    if (i > 0) {
      const k = base + 2 * i;
      out.idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
}

export function buildStreets(world: World) {
  const asphalt = new THREE.Color("#3f4247"), pave = new THREE.Color("#b8ad99"), foot = new THREE.Color("#c9bea8"), steps = new THREE.Color("#9c9488");
  const roads = { pos: [] as number[], idx: [] as number[], col: [] as number[] };
  const walks = { pos: [] as number[], idx: [] as number[], col: [] as number[] };
  const bridges = new THREE.Group();
  for (const w of world.data.ways) {
    const pts = w.p.map((i) => [world.nx[i], world.nz[i]]);
    if (/Thê Húc/.test(w.n)) {
      const red = { pos: [] as number[], idx: [] as number[], col: [] as number[] };
      ribbon(pts, 3.4, 0.6, red, new THREE.Color("#c1272d"), 2.2);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(red.pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(red.col, 3));
      g.setIndex(red.idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
      m.castShadow = true;
      bridges.add(m);
      // railings
      for (const side of [-1, 1]) {
        const rail = { pos: [] as number[], idx: [] as number[], col: [] as number[] };
        const shifted = pts.map((p, i) => {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
          return [p[0] - (dz / l) * 1.7 * side, p[1] + (dx / l) * 1.7 * side];
        });
        ribbon(shifted, 0.18, 1.7, rail, new THREE.Color("#b3141b"), 2.2);
        const rg = new THREE.BufferGeometry();
        rg.setAttribute("position", new THREE.Float32BufferAttribute(rail.pos, 3));
        rg.setAttribute("color", new THREE.Float32BufferAttribute(rail.col, 3));
        rg.setIndex(rail.idx);
        rg.computeVertexNormals();
        bridges.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: "#3a0000" })));
      }
      continue;
    }
    if (["footway", "path", "pedestrian"].includes(w.k)) ribbon(pts, w.w, 0.07, walks, foot);
    else if (w.k === "steps") ribbon(pts, w.w, 0.08, walks, steps);
    else {
      ribbon(pts, w.w + 3.6, 0.03, walks, pave);
      ribbon(pts, w.w, 0.06, roads, asphalt);
    }
  }
  const mk = (d: typeof roads, rough: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(d.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(d.col, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(d.pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(d.idx);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  };
  const roadMesh = mk(roads, 0.85);
  const walkMesh = mk(walks, 0.95);
  return { roadMesh, walkMesh, bridges };
}

// ---------------------------------------------------------------- water, green, ground

function shapeFrom(ring: number[], holes: number[][] = []) {
  const s = new THREE.Shape();
  for (let i = 0; i < ring.length; i += 2) (i === 0 ? s.moveTo : s.lineTo).call(s, ring[i], -ring[i + 1]);
  for (const h of holes) {
    const p = new THREE.Path();
    for (let i = 0; i < h.length; i += 2) (i === 0 ? p.moveTo : p.lineTo).call(p, h[i], -h[i + 1]);
    s.holes.push(p);
  }
  return s;
}

export function buildWater(world: World, u: CityUniforms) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#2e6b62", roughness: 0.08, metalness: 0.15 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vWP;")
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec2 q = vWP.xz * 0.35;
float t = uTime * 0.6;
vec3 ripple = vec3(sin(q.x * 1.7 + t) * 0.06 + sin(q.y * 2.3 - t * 1.3) * 0.05, 0.0, cos(q.y * 1.9 + t * 0.8) * 0.06 + sin((q.x + q.y) * 1.1 + t) * 0.04);
normal = normalize(normal + (viewMatrix * vec4(ripple, 0.0)).xyz);`,
      );
  };
  for (const w of world.data.water) {
    const g = new THREE.ShapeGeometry(shapeFrom(w.o, w.i));
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.y = 0.12;
    m.receiveShadow = true;
    group.add(m);
    // islands (inner rings) as grassy land with a stone edge
    for (const hole of w.i) {
      const ig = new THREE.ShapeGeometry(shapeFrom(hole));
      ig.rotateX(-Math.PI / 2);
      const im = new THREE.Mesh(ig, new THREE.MeshStandardMaterial({ color: "#6f9a5a", roughness: 1 }));
      im.position.y = 0.3;
      im.receiveShadow = true;
      group.add(im);
    }
  }
  return group;
}

export function buildGreens(world: World) {
  const shapes = world.data.green.map((r) => shapeFrom(r));
  const g = new THREE.ShapeGeometry(shapes);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#7fa05f", roughness: 1 }));
  m.position.y = 0.05;
  m.receiveShadow = true;
  return m;
}

export function buildGround(world: World) {
  const { x, z } = world.data.meta.half;
  const g = new THREE.PlaneGeometry(x * 2 + 2400, z * 2 + 2400);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#cfc4ae", roughness: 1 }));
  m.receiveShadow = true;
  m.name = "ground";
  return m;
}

export function buildTrees(world: World) {
  const pts: number[][] = [];
  const t = world.data.trees;
  for (let i = 0; i < t.length; i += 2) pts.push([t[i], t[i + 1]]);
  // fill the lake shore: the real promenade is lined with old trees
  const lake = world.data.water.find((w) => /Hoàn Kiếm/.test(w.n));
  if (lake) {
    const o = lake.o;
    let cx = 0, cz = 0;
    for (let i = 0; i < o.length; i += 2) { cx += o[i]; cz += o[i + 1]; }
    cx /= o.length / 2; cz /= o.length / 2;
    for (let i = 0; i < o.length; i += 2) {
      const j = (i + 2) % o.length;
      const len = Math.hypot(o[j] - o[i], o[j + 1] - o[i + 1]);
      for (let s = 0; s < len; s += 11) {
        const x = o[i] + ((o[j] - o[i]) * s) / len, z = o[i + 1] + ((o[j + 1] - o[i + 1]) * s) / len;
        const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1;
        pts.push([x + (dx / d) * 6, z + (dz / d) * 6]);
      }
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 4, 6);
  trunkGeo.translate(0, 2, 0);
  const crownGeo = new THREE.IcosahedronGeometry(3.2, 1);
  crownGeo.translate(0, 6.2, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: "#5b4636", roughness: 1 }), pts.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  pts.forEach(([x, z], i) => {
    const k = 0.75 + ((i * 0.618) % 1) * 0.7;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.1);
    m4.compose(p.set(x, 0, z), q, s.set(k, k, k));
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, c.setHSL(0.24 + ((i * 0.37) % 1) * 0.08, 0.45, 0.28 + ((i * 0.53) % 1) * 0.1));
  });
  trunks.castShadow = crowns.castShadow = true;
  const g = new THREE.Group();
  g.add(trunks, crowns);
  return { group: g, crowns };
}

export function buildRails(world: World) {
  const g = new THREE.Group();
  const bed = { pos: [] as number[], idx: [] as number[], col: [] as number[] };
  for (const r of world.data.rails) {
    const pts: number[][] = [];
    for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]]);
    ribbon(pts, 3.2, 0.09, bed, new THREE.Color("#6d655b"));
    for (const off of [-0.72, 0.72]) {
      const sh = pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        return [p[0] - (dz / l) * off, p[1] + (dx / l) * off];
      });
      ribbon(sh, 0.14, 0.2, bed, new THREE.Color("#8e9296"));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(bed.pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(bed.col, 3));
  geo.setIndex(bed.idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  g.add(m);
  return g;
}

/** Street lamps on drivable streets + string lights around the lake. Heads glow at night. */
export function buildLamps(world: World) {
  const spots: number[][] = [];
  for (const w of world.data.ways) {
    if (["footway", "path", "steps", "service"].includes(w.k)) continue;
    let acc = 0, side = 1;
    for (let i = 1; i < w.p.length; i++) {
      const a = w.p[i - 1], b = w.p[i];
      const dx = world.nx[b] - world.nx[a], dz = world.nz[b] - world.nz[a];
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      for (let s = (30 - acc) % 30; s < len; s += 30) {
        const t = s / len;
        const off = (w.w / 2 + 1.4) * side;
        spots.push([world.nx[a] + dx * t - (dz / len) * off, world.nz[a] + dz * t + (dx / len) * off]);
        side = -side;
      }
      acc = (acc + len) % 30;
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6, 5);
  poleGeo.translate(0, 3, 0);
  const headGeo = new THREE.SphereGeometry(0.42, 8, 6);
  headGeo.translate(0, 6.1, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: "#2f3a33", roughness: 0.7 }), spots.length);
  const headMat = new THREE.MeshStandardMaterial({ color: "#fff4d6", emissive: "#ffd28a", emissiveIntensity: 0 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
  const m4 = new THREE.Matrix4();
  const white = new THREE.Color(1, 1, 1);
  spots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0, z);
    poles.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
    heads.setColorAt(i, white);
  });
  const g = new THREE.Group();
  g.add(poles, heads);
  return { group: g, heads, headMat, spots };
}

/** Tháp Rùa — a small, recognisable tiered tower on its islet. */
export function buildTurtleTower(x: number, z: number) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#d4c39a", roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: "#5a5248", roughness: 1 });
  const tiers = [
    [6.4, 4.2],
    [5.0, 3.0],
    [3.8, 2.4],
  ];
  let y = 0.3;
  for (const [w, h] of tiers) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.78), stone);
    box.position.y = y + h / 2;
    box.castShadow = true;
    g.add(box);
    // arched openings: dark insets on each face
    for (const s of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, h * 0.55, 0.1), dark);
      arch.position.set(0, y + h * 0.42, s * (w * 0.39 + 0.02));
      g.add(arch);
    }
    y += h;
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 4), stone);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = y + 0.8;
  g.add(cap);
  g.position.set(x, 0, z);
  return g;
}
