import * as THREE from "three";
import type { WorldEvent } from "../sim/events";
import type { Sim } from "../sim/sim";

/**
 * Prepared assets that perform events: each active event gets a group built
 * from its kind + props, updated every frame and disposed when it ends.
 * Plus world-level effects: rain, the weekend night market, lake lights.
 */

let glowTex: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

function textTexture(text: string, bg = "#c1121f", fg = "#ffe08a") {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(10, 10, c.width - 20, c.height - 20);
  g.fillStyle = fg;
  g.font = "bold 64px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  let t = text;
  while (g.measureText(t).width > c.width - 80 && t.length > 4) t = t.slice(0, -2);
  if (t !== text) t = `${t.trimEnd()}…`;
  g.fillText(t, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Particles {
  pts: THREE.Points;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  col: Float32Array;
}

function particles(n: number, size: number, opts: { additive?: boolean; opacity?: number } = {}): Particles {
  const pos = new Float32Array(n * 3).fill(-9999);
  const col = new Float32Array(n * 3).fill(1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    size, map: glow(), vertexColors: true, transparent: true, depthWrite: false,
    opacity: opts.opacity ?? 1, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return { pts, pos, vel: new Float32Array(n * 3), life: new Float32Array(n), col };
}

const HUE = [new THREE.Color("#ff595e"), new THREE.Color("#ffca3a"), new THREE.Color("#8ac926"), new THREE.Color("#1982c4"), new THREE.Color("#ff99c8"), new THREE.Color("#ffffff")];

interface Built {
  group: THREE.Group;
  update: (dt: number, t: number, ev: WorldEvent) => void;
  dispose: () => void;
}

export class PropsLayer {
  readonly group = new THREE.Group();
  private built = new Map<string, Built>();
  private rain: { lines: THREE.LineSegments; pos: Float32Array };
  private market: THREE.Group | null = null;
  private lakeLights: THREE.Points | null = null;
  private flood = new Map<number, THREE.Mesh>();

  constructor(private sim: Sim) {
    const n = 5000;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 500, y = Math.random() * 160, z = (Math.random() - 0.5) * 500;
      pos.set([x, y, z, x + 0.4, y - 3.6, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#9fb0c2", transparent: true, opacity: 0, depthWrite: false }));
    lines.frustumCulled = false;
    this.rain = { lines, pos };
    this.group.add(lines);
    this.buildLakeLights();
  }

  private buildLakeLights() {
    const w = this.sim.world;
    const lake = w.data.water.find((x) => /Hoàn Kiếm/.test(x.n));
    if (!lake) return;
    const o = lake.o;
    const pts: number[] = [];
    let cx = 0, cz = 0;
    for (let i = 0; i < o.length; i += 2) { cx += o[i]; cz += o[i + 1]; }
    cx /= o.length / 2; cz /= o.length / 2;
    for (let i = 0; i < o.length; i += 2) {
      const j = (i + 2) % o.length;
      const len = Math.hypot(o[j] - o[i], o[j + 1] - o[i + 1]);
      for (let s = 0; s < len; s += 4) {
        const x = o[i] + ((o[j] - o[i]) * s) / len, z = o[i + 1] + ((o[j + 1] - o[i + 1]) * s) / len;
        const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1;
        pts.push(x + (dx / d) * 2.5, 2.2 + Math.sin(s * 0.8) * 0.3, z + (dz / d) * 2.5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.lakeLights = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, map: glow(), color: "#ffd98a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.group.add(this.lakeLights);
  }

  private buildMarket() {
    const w = this.sim.world;
    const g = new THREE.Group();
    const spots: number[][] = [];
    for (const wi of this.sim.marketWays) {
      const way = w.data.ways[wi];
      for (let i = 1; i < way.p.length; i++) {
        const a = way.p[i - 1], b = way.p[i];
        const dx = w.nx[b] - w.nx[a], dz = w.nz[b] - w.nz[a], len = Math.hypot(dx, dz);
        for (let s = 2; s < len; s += 4.5) spots.push([w.nx[a] + (dx * s) / len, w.nz[a] + (dz * s) / len, Math.atan2(dx, dz)]);
      }
    }
    const tent = new THREE.ConeGeometry(1.9, 1.1, 4);
    tent.rotateY(Math.PI / 4);
    tent.translate(0, 2.9, 0);
    const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 4);
    pole.translate(0, 1.2, 0);
    const table = new THREE.BoxGeometry(2.2, 0.8, 1.2);
    table.translate(0, 0.4, 0);
    const tents = new THREE.InstancedMesh(tent, new THREE.MeshStandardMaterial({ roughness: 0.7 }), spots.length);
    const tables = new THREE.InstancedMesh(table, new THREE.MeshStandardMaterial({ color: "#7a5c3e" }), spots.length);
    const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: "#555" }), spots.length);
    const bulbs: number[] = [];
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    spots.forEach(([x, z, h], i) => {
      m4.makeRotationY(h).setPosition(x, 0, z);
      tents.setMatrixAt(i, m4);
      tables.setMatrixAt(i, m4);
      poles.setMatrixAt(i, m4);
      tents.setColorAt(i, c.set(["#e63946", "#f1faee", "#457b9d", "#ffb703", "#2a9d8f"][i % 5]));
      bulbs.push(x, 3.6, z);
    });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute(bulbs, 3));
    const lights = new THREE.Points(bg, new THREE.PointsMaterial({ size: 2.6, map: glow(), color: "#ffcf70", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(tents, tables, poles, lights);
    g.userData.lights = lights;
    return g;
  }

  update(dt: number, camTarget: THREE.Vector3, night: number) {
    const sim = this.sim;
    const t = sim.wall;
    // rain follows the camera target
    const rainK = sim.weather.rain;
    const rm = this.rain.lines.material as THREE.LineBasicMaterial;
    rm.opacity = Math.min(0.8, rainK * 0.85);
    this.rain.lines.visible = rainK > 0.02;
    if (this.rain.lines.visible) {
      const p = this.rain.pos;
      const fall = dt * 70 * (sim.paused ? 0 : 1);
      for (let i = 0; i < p.length; i += 6) {
        p[i + 1] -= fall;
        p[i + 4] -= fall;
        if (p[i + 1] < 0) {
          const x = camTarget.x + (Math.random() - 0.5) * 500, z = camTarget.z + (Math.random() - 0.5) * 500, y = 120 + Math.random() * 40;
          p.set([x, y, z, x + 0.4, y - 3.6, z], i);
        }
      }
      this.rain.lines.geometry.attributes.position.needsUpdate = true;
    }

    // lake promenade lights + weekend night market
    if (this.lakeLights) (this.lakeLights.material as THREE.PointsMaterial).opacity = night * (sim.outages.some((o) => o.r === Infinity) ? 0 : 0.9);
    if (sim.nightMarket && !this.market) {
      this.market = this.buildMarket();
      this.group.add(this.market);
    } else if (!sim.nightMarket && this.market) {
      this.group.remove(this.market);
      this.market = null;
    }
    if (this.market) ((this.market.userData.lights as THREE.Points).material as THREE.PointsMaterial).opacity = 0.25 + night * 0.75;

    // events
    const live = new Set<string>();
    for (const ev of sim.events) {
      if (ev.ended) continue;
      live.add(ev.id);
      let b = this.built.get(ev.id);
      if (!b) {
        b = this.build(ev);
        this.built.set(ev.id, b);
        this.group.add(b.group);
      }
      b.update(sim.paused ? 0 : dt * sim.speed, t, ev);
    }
    for (const [id, b] of this.built) {
      if (!live.has(id)) {
        this.group.remove(b.group);
        b.dispose();
        this.built.delete(id);
      }
    }
    // floods
    sim.floods.forEach((f, i) => {
      let m = this.flood.get(i);
      if (!m) {
        m = floodMesh(f.r);
        this.flood.set(i, m);
        this.group.add(m);
      }
      m.position.set(f.x, 0.05 + f.level * 1.5, f.z);
      (m.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    });
    for (const [i, m] of this.flood) {
      if (i >= sim.floods.length) {
        this.group.remove(m);
        this.flood.delete(i);
      }
    }
  }

  private build(ev: WorldEvent): Built {
    const g = new THREE.Group();
    const sim = this.sim;
    const w = sim.world;
    const p = ev.place ?? { x: 0, z: 0, node: 0, name: "" };
    const updaters: ((dt: number, t: number, ev: WorldEvent) => void)[] = [];
    const disposables: { dispose: () => void }[] = [];
    const mat = (o: THREE.MeshStandardMaterialParameters) => {
      const m = new THREE.MeshStandardMaterial(o);
      disposables.push(m);
      return m;
    };
    const ringNodes = (rMin: number, rMax: number) => w.nodesWithin(p.x, p.z, rMax).filter((n) => Math.hypot(w.nx[n] - p.x, w.nz[n] - p.z) >= rMin);
    const props = new Set(ev.props);
    const radius = Number.isFinite(ev.radius) ? ev.radius : 80;

    if (ev.kind === "fire" || props.has("fire")) {
      const bx = (ev.fx.bx as number) ?? p.x, bz = (ev.fx.bz as number) ?? p.z, bh = (ev.fx.bh as number) ?? 10;
      const flames = particles(260, 2.8, { additive: true, opacity: 0.6 });
      const smoke = particles(160, 16, { opacity: 0.75 });
      const jet = particles(120, 1.6, { additive: true });
      g.add(flames.pts, smoke.pts, jet.pts);
      const light = new THREE.PointLight("#ff7a1a", 0, 120, 1.6);
      light.position.set(bx, bh + 4, bz);
      g.add(light);
      const fc = new THREE.Color();
      updaters.push((dt, t, e) => {
        const heat = (e.fx.heat as number) ?? 1;
        light.intensity = heat * (380 + Math.sin(t * 23) * 70 + Math.sin(t * 7) * 60) * (0.4 + sim.night);
        for (let i = 0; i < 260; i++) {
          flames.life[i] -= dt * 1.4;
          if (flames.life[i] <= 0) {
            if (Math.random() > heat) { flames.pos[i * 3 + 1] = -9999; continue; }
            flames.life[i] = 0.5 + Math.random() * 0.8;
            flames.pos.set([bx + (Math.random() - 0.5) * 7, bh * (0.35 + Math.random() * 0.65), bz + (Math.random() - 0.5) * 7], i * 3);
            flames.vel.set([(Math.random() - 0.5) * 1.5, 4 + Math.random() * 5, (Math.random() - 0.5) * 1.5], i * 3);
          }
          for (let k = 0; k < 3; k++) flames.pos[i * 3 + k] += flames.vel[i * 3 + k] * dt;
          fc.setHSL(0.015 + flames.life[i] * 0.07, 1, 0.32 + flames.life[i] * 0.16);
          flames.col.set([fc.r, fc.g, fc.b], i * 3);
        }
        for (let i = 0; i < 160; i++) {
          smoke.life[i] -= dt * 0.25;
          if (smoke.life[i] <= 0) {
            if (Math.random() > heat + 0.2) { smoke.pos[i * 3 + 1] = -9999; continue; }
            smoke.life[i] = 1;
            smoke.pos.set([bx + (Math.random() - 0.5) * 5, bh + 3, bz + (Math.random() - 0.5) * 5], i * 3);
            smoke.vel.set([1.5 + Math.random(), 5 + Math.random() * 3, 0.6 + (Math.random() - 0.5)], i * 3);
          }
          for (let k = 0; k < 3; k++) smoke.pos[i * 3 + k] += smoke.vel[i * 3 + k] * dt;
          const s = 0.08 + (1 - smoke.life[i]) * 0.3;
          smoke.col.set([s, s, s * 1.05], i * 3);
        }
        // water jets once the engine is here
        const truck = sim.actors.find((a) => a.id === e.fx.truck);
        for (let i = 0; i < 120; i++) {
          jet.life[i] -= dt;
          if (jet.life[i] <= 0) {
            if (!e.fx.arrived || !truck) { jet.pos[i * 3 + 1] = -9999; continue; }
            jet.life[i] = 1.1;
            const dx = bx - truck.x, dz = bz - truck.z, d = Math.hypot(dx, dz) || 1;
            jet.pos.set([truck.x, 4, truck.z], i * 3);
            jet.vel.set([(dx / d) * d * 0.9 + (Math.random() - 0.5) * 2, bh * 0.9 + 6 + Math.random() * 2, (dz / d) * d * 0.9 + (Math.random() - 0.5) * 2], i * 3);
          }
          jet.vel[i * 3 + 1] -= 9.8 * dt;
          for (let k = 0; k < 3; k++) jet.pos[i * 3 + k] += jet.vel[i * 3 + k] * dt;
          jet.col.set([0.75, 0.88, 1], i * 3);
        }
        for (const P of [flames, smoke, jet]) {
          P.pts.geometry.attributes.position.needsUpdate = true;
          P.pts.geometry.attributes.color.needsUpdate = true;
        }
      });
      disposables.push(flames.pts.geometry, smoke.pts.geometry, jet.pts.geometry);
    }

    if (props.has("lantern") || ev.kind === "festival") {
      const spots: number[] = [];
      for (const wi of (ev.fx.ways as number[]) ?? []) {
        const way = w.data.ways[wi];
        for (let i = 1; i < way.p.length; i++) {
          const a = way.p[i - 1], b = way.p[i];
          const dx = w.nx[b] - w.nx[a], dz = w.nz[b] - w.nz[a], len = Math.hypot(dx, dz);
          for (let s = 0; s < len; s += 2.6) {
            const x = w.nx[a] + (dx * s) / len, z = w.nz[a] + (dz * s) / len;
            if (Math.hypot(x - p.x, z - p.z) < radius * 1.2) spots.push(x, 6.5 + Math.sin(s * 1.3) * 0.5, z);
          }
        }
      }
      const geo = new THREE.SphereGeometry(0.45, 8, 6);
      geo.scale(1, 1.25, 1);
      const lan = new THREE.InstancedMesh(geo, mat({ color: "#ffffff", emissive: "#ff5a1f", emissiveIntensity: 1.6 }), Math.max(1, spots.length / 3));
      const m4 = new THREE.Matrix4(), c = new THREE.Color();
      for (let i = 0; i < spots.length / 3; i++) {
        m4.makeTranslation(spots[3 * i], spots[3 * i + 1], spots[3 * i + 2]);
        lan.setMatrixAt(i, m4);
        lan.setColorAt(i, c.set(i % 3 === 0 ? "#ffd166" : "#e63946"));
      }
      g.add(lan);
      disposables.push(geo);
    }

    if (props.has("stage")) {
      const st = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 7), mat({ color: "#2b2d42" }));
      deck.position.y = 0.6;
      const back = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 0.4), mat({ color: "#1a1a2e", emissive: "#3a0ca3", emissiveIntensity: 0.4 }));
      back.position.set(0, 4.2, -3.3);
      const truss = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 0.4), mat({ color: "#adb5bd", metalness: 0.8 }));
      truss.position.set(0, 8, -1);
      st.add(deck, back, truss);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.5), new THREE.MeshBasicMaterial({ map: textTexture(ev.headline, "#3a0ca3", "#ffd166") }));
      screen.position.set(0, 4.6, -3.05);
      st.add(screen);
      const sn = ringNodes(8, 40)[0];
      st.position.set(sn !== undefined ? w.nx[sn] : p.x, 0, sn !== undefined ? w.nz[sn] : p.z);
      st.lookAt(p.x, 0, p.z);
      g.add(st);
    }

    if (props.has("spotlight") || props.has("stage")) {
      const beams: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const geo = new THREE.ConeGeometry(4, 60, 16, 1, true);
        geo.translate(0, -30, 0);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: HUE[i % HUE.length], transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.position.set(p.x + (i - 1.5) * 6, 0.5, p.z);
        m.rotation.x = Math.PI;
        beams.push(m);
        g.add(m);
        disposables.push(geo);
      }
      updaters.push((_dt, t) => {
        beams.forEach((b, i) => {
          b.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.5;
          b.rotation.x = Math.PI + Math.cos(t * 0.5 + i) * 0.35;
          (b.material as THREE.MeshBasicMaterial).opacity = 0.06 + 0.12 * sim.night;
        });
      });
    }

    if (props.has("barrier")) {
      const ns = ringNodes(radius * 0.7, radius * 1.05).slice(0, 14);
      const geo = new THREE.BoxGeometry(2.4, 1, 0.3);
      geo.translate(0, 0.5, 0);
      const tex = (() => {
        const c = document.createElement("canvas");
        c.width = 64; c.height = 16;
        const x = c.getContext("2d")!;
        for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#ffffff" : "#d62828"; x.fillRect(i * 8, 0, 8, 16); }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      const bm = new THREE.InstancedMesh(geo, mat({ map: tex }), Math.max(1, ns.length));
      const m4 = new THREE.Matrix4();
      ns.forEach((n, i) => {
        m4.makeRotationY(Math.atan2(w.nx[n] - p.x, w.nz[n] - p.z) + Math.PI / 2).setPosition(w.nx[n], 0, w.nz[n]);
        bm.setMatrixAt(i, m4);
      });
      bm.castShadow = true;
      g.add(bm);
      disposables.push(geo);
    }

    if (props.has("tent")) {
      for (let i = 0; i < 3; i++) {
        const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4), mat({ color: "#f8f9fa" }));
        tent.position.set(p.x + 9 + i * 5.5, 3.2, p.z + 6);
        tent.rotation.y = Math.PI / 4;
        tent.castShadow = true;
        g.add(tent);
      }
    }

    if (props.has("camera") || ev.kind === "filming") {
      const cam = new THREE.Group();
      const legs = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 3, 1, true), mat({ color: "#222", side: THREE.DoubleSide }));
      legs.position.y = 0.8;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.2), mat({ color: "#111" }));
      body.position.y = 1.9;
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10), mat({ color: "#333", metalness: 0.8 }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 1.9, 0.8);
      cam.add(legs, body, lens);
      cam.position.set(p.x + 7, 0, p.z + 7);
      cam.lookAt(p.x, 0, p.z);
      g.add(cam);
    }

    if (props.has("balloons")) {
      const n = 40;
      const geo = new THREE.SphereGeometry(0.5, 10, 8);
      const bl = new THREE.InstancedMesh(geo, mat({ roughness: 0.3 }), n);
      const base: number[] = [];
      for (let i = 0; i < n; i++) base.push(p.x + (Math.random() - 0.5) * 6, 5 + Math.random() * 3, p.z + (Math.random() - 0.5) * 6);
      for (let i = 0; i < n; i++) bl.setColorAt(i, HUE[i % HUE.length]);
      const m4 = new THREE.Matrix4();
      updaters.push((_dt, t) => {
        for (let i = 0; i < n; i++) {
          m4.makeTranslation(base[3 * i] + Math.sin(t + i) * 0.3, base[3 * i + 1] + Math.sin(t * 1.3 + i * 2) * 0.25, base[3 * i + 2]);
          bl.setMatrixAt(i, m4);
        }
        bl.instanceMatrix.needsUpdate = true;
      });
      g.add(bl);
      disposables.push(geo);
    }

    if (props.has("flags") && ev.kind !== "celebration") {
      const ns = ringNodes(0, radius).slice(0, 30);
      const geo = new THREE.PlaneGeometry(1.4, 0.95);
      geo.translate(0.7, 5.6, 0);
      const pole = new THREE.CylinderGeometry(0.05, 0.05, 6.2, 4);
      pole.translate(0, 3.1, 0);
      const fm = new THREE.InstancedMesh(geo, mat({ color: "#da251d", side: THREE.DoubleSide, emissive: "#3a0000" }), Math.max(1, ns.length));
      const pm = new THREE.InstancedMesh(pole, mat({ color: "#ccc" }), Math.max(1, ns.length));
      const m4 = new THREE.Matrix4();
      ns.forEach((n, i) => {
        m4.makeRotationY(i * 0.7).setPosition(w.nx[n] + 3, 0, w.nz[n]);
        fm.setMatrixAt(i, m4);
        pm.setMatrixAt(i, m4);
      });
      g.add(fm, pm);
      disposables.push(geo, pole);
    }

    if (props.has("banner") || props.has("stage") || ev.kind === "festival" || ev.kind === "parade") {
      const way = ((ev.fx.ways as number[]) ?? [])[0];
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshBasicMaterial({ map: textTexture(ev.headline), side: THREE.DoubleSide }));
      plane.position.set(p.x, 8.5, p.z);
      if (way !== undefined) {
        const wy = w.data.ways[way];
        const a = wy.p[0], b = wy.p[wy.p.length - 1];
        plane.rotation.y = Math.atan2(w.nx[b] - w.nx[a], w.nz[b] - w.nz[a]) + Math.PI / 2;
      }
      g.add(plane);
    }

    if (props.has("fireworks") || ev.kind === "celebration" || (ev.kind === "festival" && sim.night > 0.4)) {
      const n = 900;
      const fw = particles(n, 5.5, { additive: true });
      g.add(fw.pts);
      let next = 0;
      let cursor = 0;
      let lastT = -1;
      const cx = p.x, cz = p.z;
      updaters.push((_dt, t) => {
        // fireworks run on wall-clock time so they read at any sim speed
        const dt = lastT < 0 ? 0 : Math.min(0.1, t - lastT);
        lastT = t;
        if (t > next && sim.night > 0.25) {
          next = t + 0.25 + Math.random() * 0.7;
          const ox = cx + (Math.random() - 0.5) * 140, oy = 45 + Math.random() * 40, oz = cz + (Math.random() - 0.5) * 140;
          const col = HUE[Math.floor(Math.random() * HUE.length)];
          for (let k = 0; k < 150; k++) {
            const i = cursor++ % n;
            const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 18 + Math.random() * 6;
            fw.pos.set([ox, oy, oz], i * 3);
            fw.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], i * 3);
            fw.life[i] = 1.6;
            fw.col.set([col.r, col.g, col.b], i * 3);
          }
        }
        for (let i = 0; i < n; i++) {
          if (fw.life[i] <= 0) continue;
          fw.life[i] -= dt;
          fw.vel[i * 3 + 1] -= 9 * dt;
          for (let k = 0; k < 3; k++) {
            fw.vel[i * 3 + k] *= 1 - dt * 0.9;
            fw.pos[i * 3 + k] += fw.vel[i * 3 + k] * dt;
          }
          const f = Math.max(0, fw.life[i] / 1.6);
          fw.col[i * 3] *= 0.995; fw.col[i * 3 + 1] *= 0.995; fw.col[i * 3 + 2] *= 0.995;
          if (f <= 0) fw.pos[i * 3 + 1] = -9999;
        }
        fw.pts.geometry.attributes.position.needsUpdate = true;
        fw.pts.geometry.attributes.color.needsUpdate = true;
      });
      disposables.push(fw.pts.geometry);
    }

    if (props.has("smoke") && ev.kind !== "fire") {
      const sm = particles(90, 12, { opacity: 0.45 });
      g.add(sm.pts);
      updaters.push((dt) => {
        for (let i = 0; i < 90; i++) {
          sm.life[i] -= dt * 0.3;
          if (sm.life[i] <= 0) {
            sm.life[i] = 1;
            sm.pos.set([p.x + (Math.random() - 0.5) * 6, 1, p.z + (Math.random() - 0.5) * 6], i * 3);
            sm.vel.set([1 + Math.random(), 3 + Math.random() * 2, 0.5], i * 3);
          }
          for (let k = 0; k < 3; k++) sm.pos[i * 3 + k] += sm.vel[i * 3 + k] * dt;
          sm.col.set([0.5, 0.5, 0.52], i * 3);
        }
        sm.pts.geometry.attributes.position.needsUpdate = true;
      });
    }

    if (props.has("confetti")) {
      const cf = particles(400, 0.9);
      g.add(cf.pts);
      updaters.push((dt) => {
        for (let i = 0; i < 400; i++) {
          cf.life[i] -= dt * 0.25;
          if (cf.life[i] <= 0) {
            cf.life[i] = 1;
            cf.pos.set([p.x + (Math.random() - 0.5) * 40, 25 + Math.random() * 10, p.z + (Math.random() - 0.5) * 40], i * 3);
            const c = HUE[i % HUE.length];
            cf.col.set([c.r, c.g, c.b], i * 3);
          }
          cf.pos[i * 3 + 1] -= dt * 4;
          cf.pos[i * 3] += Math.sin(i + cf.life[i] * 10) * dt;
        }
        cf.pts.geometry.attributes.position.needsUpdate = true;
        cf.pts.geometry.attributes.color.needsUpdate = true;
      });
    }

    if (ev.kind === "accident") {
      for (let i = 0; i < 2; i++) {
        const bike = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 2.6), mat({ color: i ? "#1d3557" : "#c1121f" }));
        bike.position.set(p.x + (i ? 2 : -1), 0.35, p.z + (i ? 1 : -1));
        bike.rotation.set(0, i * 1.2 + 0.4, Math.PI / 2);
        g.add(bike);
      }
    }

    if (ev.kind === "train") {
      const rail = (ev.fx.rail as number[]) ?? [];
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < rail.length; i += 2) pts.push(new THREE.Vector3(rail[i], 0, rail[i + 1]));
      if (pts.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
        const len = curve.getLength();
        const cars: THREE.Group[] = [];
        for (let i = 0; i < 9; i++) {
          const car = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 12.5), mat({ color: i === 0 ? "#1d3557" : "#274c77", roughness: 0.5 }));
          body.position.y = 2.3;
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.35, 12.55), mat({ color: "#ffd166" }));
          stripe.position.y = 1.4;
          const windows = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.9, 11), mat({ color: "#111", emissive: "#ffd28a", emissiveIntensity: 0.15 + sim.night }));
          windows.position.y = 3;
          car.add(body, stripe, windows);
          if (i === 0) {
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: "#fff7d6" }));
            lamp.position.set(0, 3.2, 6.3);
            car.add(lamp);
          }
          car.traverse((o) => ((o as THREE.Mesh).castShadow = true));
          cars.push(car);
          g.add(car);
        }
        updaters.push((_dt, _t, e) => {
          const s = (e.fx.s as number) ?? 0;
          cars.forEach((car, i) => {
            const d = s - i * 13.5;
            if (d < 0 || d > len) {
              car.visible = false;
              return;
            }
            car.visible = true;
            const u = d / len;
            const pt = curve.getPointAt(u);
            const tg = curve.getTangentAt(u);
            car.position.copy(pt);
            car.rotation.y = Math.atan2(tg.x, tg.z);
          });
        });
      }
    }

    return {
      group: g,
      update: (dt, t, e) => updaters.forEach((u) => u(dt, t, e)),
      dispose: () => {
        disposables.forEach((d) => d.dispose());
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
        });
      },
    };
  }
}

function floodMesh(r: number) {
  const geo = new THREE.CircleGeometry(r, 64);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uR: { value: r } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uR; varying vec2 vP;
      void main(){
        float d = length(vP) / uR;
        float edge = smoothstep(1.0, 0.7, d);
        float rip = 0.5 + 0.5 * sin(vP.x * 0.9 + uTime * 1.5) * sin(vP.y * 0.8 - uTime * 1.2);
        vec3 col = mix(vec3(0.33, 0.33, 0.24), vec3(0.45, 0.47, 0.36), rip * 0.5);
        gl_FragColor = vec4(col, 0.78 * edge);
      }`,
  });
  return new THREE.Mesh(geo, m);
}
