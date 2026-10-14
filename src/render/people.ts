import * as THREE from "three";
import type { Agent } from "../sim/agent";
import type { Sim } from "../sim/sim";

/** People are drawn ~1.5× life size so they read from a city-scale camera. */
export const PEOPLE_SCALE = 1.5;
const MAX_PEDS = 900;
const MAX_BIKES = 900;

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0xffdbac, 0x8d5524];
const PONCHO = [0x2a9d8f, 0xe9c46a, 0x3a86ff, 0xef476f, 0x8338ec, 0x06d6a0];

function inst(geo: THREE.BufferGeometry, mat: THREE.Material, n: number) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  m.frustumCulled = false;
  return m;
}

export class PeopleLayer {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private hatLeaf: THREE.InstancedMesh;
  private cap: THREE.InstancedMesh;
  private umbrella: THREE.InstancedMesh;
  private flag: THREE.InstancedMesh;
  private torch: THREE.InstancedMesh;
  private bike: THREE.InstancedMesh;
  private rider: THREE.InstancedMesh;
  private helmet: THREE.InstancedMesh;
  private headlight: THREE.InstancedMesh;
  private bikeFlag: THREE.InstancedMesh;
  private special = new Map<number, THREE.Object3D>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);
  readonly lightMat: THREE.MeshBasicMaterial;
  readonly selectRing: THREE.Mesh;

  constructor() {
    const std = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
    const bodyGeo = new THREE.CapsuleGeometry(0.24, 0.75, 3, 8);
    bodyGeo.translate(0, 0.62, 0);
    const headGeo = new THREE.SphereGeometry(0.19, 10, 8);
    headGeo.translate(0, 1.36, 0);
    const leafGeo = new THREE.ConeGeometry(0.42, 0.26, 14, 1, true);
    leafGeo.translate(0, 1.58, 0);
    const capGeo = new THREE.SphereGeometry(0.21, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.translate(0, 1.4, 0);
    const umbGeo = new THREE.ConeGeometry(0.85, 0.32, 10, 1, true);
    umbGeo.translate(0, 2.05, 0);
    const flagGeo = new THREE.PlaneGeometry(0.75, 0.5);
    flagGeo.translate(0.38, 2.1, 0);
    const torchGeo = new THREE.SphereGeometry(0.07, 6, 4);
    torchGeo.translate(0.25, 1.05, 0.22);

    this.body = inst(bodyGeo, std(), MAX_PEDS);
    this.head = inst(headGeo, std({ roughness: 0.6 }), MAX_PEDS);
    this.hatLeaf = inst(leafGeo, std({ color: "#dcc88f", side: THREE.DoubleSide }), MAX_PEDS);
    this.cap = inst(capGeo, std(), MAX_PEDS);
    this.umbrella = inst(umbGeo, std({ side: THREE.DoubleSide, roughness: 0.5 }), MAX_PEDS);
    this.flag = inst(flagGeo, std({ color: "#da251d", side: THREE.DoubleSide, emissive: "#3a0000" }), MAX_PEDS);
    this.lightMat = new THREE.MeshBasicMaterial({ color: "#fffbe8" });
    this.torch = inst(torchGeo, this.lightMat, MAX_PEDS);

    const bikeGeo = new THREE.BoxGeometry(0.42, 0.55, 1.75);
    bikeGeo.translate(0, 0.45, 0);
    const riderGeo = new THREE.CapsuleGeometry(0.24, 0.5, 3, 8);
    riderGeo.translate(0, 1.15, -0.15);
    const helmetGeo = new THREE.SphereGeometry(0.22, 10, 8);
    helmetGeo.translate(0, 1.72, -0.12);
    const hlGeo = new THREE.SphereGeometry(0.09, 6, 4);
    hlGeo.translate(0, 0.75, 0.92);
    const bfGeo = new THREE.PlaneGeometry(0.8, 0.55);
    bfGeo.translate(0.4, 2.3, -0.5);
    this.bike = inst(bikeGeo, std({ metalness: 0.3, roughness: 0.5 }), MAX_BIKES);
    this.rider = inst(riderGeo, std(), MAX_BIKES);
    this.helmet = inst(helmetGeo, std({ roughness: 0.4 }), MAX_BIKES);
    this.headlight = inst(hlGeo, new THREE.MeshBasicMaterial({ color: "#fff6d0" }), MAX_BIKES);
    this.bikeFlag = inst(bfGeo, std({ color: "#da251d", side: THREE.DoubleSide, emissive: "#3a0000" }), MAX_BIKES);

    for (const m of [this.body, this.head, this.cap, this.umbrella, this.bike, this.rider, this.helmet]) m.setColorAt(0, new THREE.Color(1, 1, 1));
    this.group.add(this.body, this.head, this.hatLeaf, this.cap, this.umbrella, this.flag, this.torch, this.bike, this.rider, this.helmet, this.headlight, this.bikeFlag);

    const ring = new THREE.RingGeometry(1.1, 1.45, 32);
    ring.rotateX(-Math.PI / 2);
    this.selectRing = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.95, depthWrite: false }));
    this.selectRing.visible = false;
    this.group.add(this.selectRing);
  }

  private set(m: THREE.InstancedMesh, i: number, a: Agent, y: number, scale: number, tilt = 0) {
    this.q.setFromAxisAngle(this.up, a.heading);
    if (tilt) this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
    this.m4.compose(this.v.set(a.x, y, a.z), this.q, this.s.setScalar(scale));
    m.setMatrixAt(i, this.m4);
  }

  update(sim: Sim, dt: number, night: number) {
    let p = 0, b = 0;
    const rain = sim.weather.rain > 0.2;
    const peds: Agent[] = [];
    const bikes: Agent[] = [];
    for (const a of sim.walkers) if (a.state !== "inside") peds.push(a);
    for (const r of sim.residents) if (r.a.state !== "inside") peds.push(r.a);
    for (const a of sim.bikes) if (a.state === "move") bikes.push(a);
    for (const a of sim.actors) {
      if (a.kind === "bike") bikes.push(a);
      else if (["firefighter", "police", "drummer", "marcher", "performer", "camera"].includes(a.actor ?? "")) peds.push(a);
    }
    let u = 0, f = 0, t = 0, leaf = 0, cap = 0;
    for (const a of peds) {
      if (p >= MAX_PEDS) break;
      const moving = a.state === "move";
      if (moving) a.phase += dt * a.speed * 3.2;
      const bob = moving ? Math.abs(Math.sin(a.phase)) * 0.07 : 0;
      const sc = PEOPLE_SCALE * a.scale * (a.kind === "resident" ? 1.08 : 1);
      this.set(this.body, p, a, bob, sc);
      this.set(this.head, p, a, bob, sc);
      this.body.setColorAt(p, this.c.setHex(a.actor === "firefighter" ? 0x2b2d42 : a.actor === "police" ? 0xb5a642 : a.color));
      this.head.setColorAt(p, this.c.setHex(SKIN[a.id % SKIN.length]));
      if (a.hat === 1 && !(rain && a.umbrella)) this.set(this.hatLeaf, leaf++, a, bob, sc);
      if (a.hat === 2 || a.actor === "police" || a.actor === "firefighter") {
        this.set(this.cap, cap, a, bob, sc);
        this.cap.setColorAt(cap++, this.c.setHex(a.actor === "firefighter" ? 0xd62828 : a.actor === "police" ? 0x2d6a4f : 0xffffff));
      }
      if (a.umbrella && rain) {
        this.set(this.umbrella, u, a, bob, sc);
        this.umbrella.setColorAt(u++, this.c.setHex(PONCHO[a.id % PONCHO.length]));
      }
      if (a.flag) this.set(this.flag, f++, a, bob + Math.sin(a.phase * 0.7) * 0.05, sc);
      if (night > 0.5 && (a.light || sim.outages.some((o) => (a.x - o.x) ** 2 + (a.z - o.z) ** 2 < o.r * o.r)) && a.id % 3 === 0) this.set(this.torch, t++, a, bob, sc);
      p++;
    }
    let bf = 0;
    for (const a of bikes) {
      if (b >= MAX_BIKES) break;
      const sc = PEOPLE_SCALE * 0.95;
      this.set(this.bike, b, a, 0, sc);
      this.set(this.rider, b, a, 0, sc);
      this.set(this.helmet, b, a, 0, sc);
      this.set(this.headlight, b, a, 0, night > 0.35 ? sc : 0.0001);
      this.bike.setColorAt(b, this.c.setHex(a.color));
      this.rider.setColorAt(b, this.c.setHex(rain ? PONCHO[a.id % PONCHO.length] : [0x264653, 0xe76f51, 0xf4f1de, 0x3d405b, 0x81b29a][a.id % 5]));
      this.helmet.setColorAt(b, this.c.setHex([0xffffff, 0xe63946, 0x1d3557, 0xffb703, 0x111111][a.id % 5]));
      if (a.flag) this.set(this.bikeFlag, bf++, a, Math.sin(sim.wall * 6 + a.id) * 0.06, sc);
      b++;
    }
    const fin = (m: THREE.InstancedMesh, n: number) => {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    fin(this.body, p); fin(this.head, p); fin(this.hatLeaf, leaf); fin(this.cap, cap); fin(this.umbrella, u); fin(this.flag, f); fin(this.torch, t);
    fin(this.bike, b); fin(this.rider, b); fin(this.helmet, b); fin(this.headlight, b); fin(this.bikeFlag, bf);
    this.updateSpecial(sim, dt);

    const sel = sim.selected != null ? sim.agentById(sim.selected) : undefined;
    if (sel && sel.state !== "inside" && sel.state !== "off") {
      this.selectRing.visible = true;
      this.selectRing.position.set(sel.x, 0.15, sel.z);
      const k = 1 + Math.sin(sim.wall * 5) * 0.12;
      this.selectRing.scale.setScalar(k * (sel.actor === "firetruck" || sel.actor === "ambulance" ? 3.5 : sel.actor === "lion" ? 2.5 : 1));
    } else this.selectRing.visible = false;
  }

  /** Vehicles, animals and the lion get their own small meshes. */
  private updateSpecial(sim: Sim, dt: number) {
    const live = new Set<number>();
    for (const a of sim.actors) {
      if (!["firetruck", "ambulance", "lion", "buffalo", "dog", "chicken"].includes(a.actor ?? "")) continue;
      live.add(a.id);
      let o = this.special.get(a.id);
      if (!o) {
        o = makeSpecial(a);
        this.special.set(a.id, o);
        this.group.add(o);
      }
      o.position.set(a.x, 0, a.z);
      o.rotation.y = a.heading;
      if (a.actor === "lion") {
        a.phase += dt * 6;
        o.position.y = Math.abs(Math.sin(a.phase)) * 0.35;
        o.rotation.z = Math.sin(a.phase * 0.5) * 0.12;
      } else if (a.state === "move" && (a.actor === "buffalo" || a.actor === "dog" || a.actor === "chicken")) {
        a.phase += dt * a.speed * 3;
        o.position.y = Math.abs(Math.sin(a.phase)) * 0.12;
      }
      const beacon = o.getObjectByName("beacon") as THREE.Mesh | undefined;
      if (beacon) (beacon.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(sim.wall * 14) > 0 ? 0xff2d2d : 0x2d6bff);
    }
    for (const [id, o] of this.special) {
      if (!live.has(id)) {
        this.group.remove(o);
        this.special.delete(id);
      }
    }
  }

  /** Nearest visible agent to a ground point, within `r` metres. */
  pick(sim: Sim, x: number, z: number, r = 4): Agent | null {
    let best: Agent | null = null, bd = r * r;
    const consider = (a: Agent, bias = 1) => {
      if (a.state === "inside" || a.state === "off") return;
      const d = ((a.x - x) ** 2 + (a.z - z) ** 2) / bias;
      if (d < bd) { bd = d; best = a; }
    };
    for (const res of sim.residents) consider(res.a, 2.5); // residents are easier to hit
    for (const a of sim.actors) consider(a, 1.5);
    for (const a of sim.walkers) consider(a);
    for (const a of sim.bikes) if (a.state === "move") consider(a);
    return best;
  }
}

function makeSpecial(a: Agent): THREE.Object3D {
  const g = new THREE.Group();
  const std = (c: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const box = (w: number, h: number, l: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, o: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), std(c, o));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  switch (a.actor) {
    case "firetruck": {
      box(2.5, 2.3, 7.5, "#c1121f", 0, 1.55, 0);
      box(2.4, 1.2, 2.2, "#e5e5e5", 0, 2.1, 2.6);
      box(0.5, 0.3, 6.5, "#d9d9d9", 0, 2.9, -0.6, { metalness: 0.7 });
      box(2.6, 0.5, 7.6, "#222", 0, 0.45, 0);
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: "#ff2d2d" }));
      beacon.position.set(0, 2.85, 2.7);
      beacon.name = "beacon";
      g.add(beacon);
      break;
    }
    case "ambulance": {
      box(2.3, 2.4, 5.8, "#f8f9fa", 0, 1.5, 0);
      box(2.32, 0.35, 5.82, "#d62828", 0, 1.4, 0);
      box(2.4, 0.5, 5.9, "#222", 0, 0.4, 0);
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: "#2d6bff" }));
      beacon.position.set(0, 2.85, 1.8);
      beacon.name = "beacon";
      g.add(beacon);
      break;
    }
    case "lion": {
      const c = a.color;
      box(1.5, 1.5, 3.6, c, 0, 1.4, -0.5, { emissive: c, emissiveIntensity: 0.15 });
      const headM = box(2.0, 1.8, 1.4, c === 0xffc300 ? "#ffd60a" : "#e63946", 0, 1.9, 1.7, { emissive: "#661100", emissiveIntensity: 0.3 });
      headM.rotation.x = -0.15;
      box(0.35, 0.35, 0.1, "#fff", -0.5, 2.3, 2.45, { emissive: "#ffffff", emissiveIntensity: 0.6 });
      box(0.35, 0.35, 0.1, "#fff", 0.5, 2.3, 2.45, { emissive: "#ffffff", emissiveIntensity: 0.6 });
      box(1.2, 0.2, 0.4, "#2b9348", 0, 2.95, 1.6);
      for (const s of [-0.4, 0.4]) for (const zz of [0.9, -1.8]) box(0.25, 0.9, 0.25, "#222", s, 0.45, zz);
      g.scale.setScalar(1.25);
      break;
    }
    case "buffalo": {
      box(1.3, 1.2, 2.6, "#3d3d3d", 0, 1.3, 0);
      box(0.8, 0.8, 0.9, "#333", 0, 1.6, 1.6);
      box(1.8, 0.15, 0.15, "#cfc6b4", 0, 2.05, 1.5);
      for (const s of [-0.45, 0.45]) for (const zz of [0.9, -0.9]) box(0.25, 0.8, 0.25, "#2a2a2a", s, 0.4, zz);
      g.scale.setScalar(1.3);
      break;
    }
    case "dog": {
      box(0.45, 0.45, 1.0, "#c68642", 0, 0.6, 0);
      box(0.4, 0.4, 0.45, "#b5753a", 0, 0.85, 0.6);
      for (const s of [-0.15, 0.15]) for (const zz of [0.35, -0.35]) box(0.12, 0.4, 0.12, "#8d5524", s, 0.2, zz);
      g.scale.setScalar(1.6);
      break;
    }
    case "chicken": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), std("#f5f5f5"));
      body.position.y = 0.5;
      g.add(body);
      box(0.12, 0.2, 0.12, "#d62828", 0, 0.9, 0.25);
      box(0.08, 0.3, 0.08, "#f4a261", 0.1, 0.15, 0);
      box(0.08, 0.3, 0.08, "#f4a261", -0.1, 0.15, 0);
      g.scale.setScalar(1.6);
      break;
    }
  }
  return g;
}
