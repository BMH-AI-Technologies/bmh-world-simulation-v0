import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { daylight } from "../sim/core";
import type { Agent } from "../sim/agent";
import { CATALOG } from "../sim/events";
import type { Sim } from "../sim/sim";
import { buildBuildings, buildGreens, buildGround, buildLamps, buildRails, buildStreets, buildTrees, buildTurtleTower, buildWater, cityUniforms } from "./city";
import { PeopleLayer } from "./people";
import { PropsLayer } from "./props";

const C = (h: string) => new THREE.Color(h);
const SKY = { night: C("#0a1022"), dawn: C("#f0a868"), day: C("#b9d4e6"), rain: C("#7d8a96") };

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: MapControls;
  private labels: CSS2DRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private u = cityUniforms();
  private people = new PeopleLayer();
  private props: PropsLayer;
  private lampMat: THREE.MeshStandardMaterial;
  private lamps: ReturnType<typeof buildLamps>;
  private resLabels = new Map<number, { obj: CSS2DObject; name: HTMLDivElement; bubble: HTMLDivElement }>();
  private evLabels = new Map<string, CSS2DObject>();
  private lmLabels: CSS2DObject[] = [];
  private ground: THREE.Mesh;
  private ray = new THREE.Raycaster();
  private lastOutKey = "";
  follow = true;
  private lastSel: number | null = null;
  private clock = new THREE.Clock();
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private sim: Sim,
    private onPick: (a: Agent | null, point: THREE.Vector3) => void,
  ) {
    const w = host.clientWidth, h = host.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    Object.assign(this.labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    host.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 1, 6000);
    const lake = sim.world.lakeCenter ?? sim.world.landmarks[0];
    this.camera.position.set(lake.x + 260, 380, lake.z + 420);
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.target.set(lake.x - 60, 0, lake.z - 180);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.38;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 1800;
    this.controls.update();
    this.controls.addEventListener("start", () => {
      // dragging the map breaks follow mode until the user re-selects
      if (this.dragBreaksFollow) this.follow = false;
    });

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;

    this.hemi = new THREE.HemisphereLight("#cfe3ff", "#8a7f6a", 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#fff1d6", 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -900; sc.right = 900; sc.top = 900; sc.bottom = -900; sc.near = 10; sc.far = 3000;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(SKY.day, 900, 3200);

    const world = sim.world;
    this.ground = buildGround(world);
    const { mesh, tanks } = buildBuildings(world, this.u);
    const { roadMesh, walkMesh, bridges } = buildStreets(world);
    this.lamps = buildLamps(world);
    this.lampMat = this.lamps.headMat;
    this.scene.add(this.ground, walkMesh, roadMesh, bridges, buildGreens(world), buildWater(world, this.u), mesh, tanks, buildTrees(world).group, buildRails(world), this.lamps.group);
    const tower = world.landmarks.find((l) => l.name === "Tháp Rùa");
    if (tower) this.scene.add(buildTurtleTower(tower.x, tower.z));
    this.props = new PropsLayer(sim);
    this.scene.add(this.people.group, this.props.group);

    for (const l of world.landmarks) {
      if (["Nhà 48 phố Hàng Ngang", "Tháp nước Hàng Đậu", "Đình Kim Ngân"].includes(l.name)) continue;
      const el = document.createElement("div");
      el.className = "lm-label";
      el.textContent = l.name;
      const o = new CSS2DObject(el);
      const c = l.kind === "lake" && world.lakeCenter ? world.lakeCenter : l;
      o.position.set(c.x, l.kind === "lake" ? 8 : 26, c.z);
      this.lmLabels.push(o);
      this.scene.add(o);
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.4, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    this.renderer.domElement.addEventListener("pointerup", this.onUp);
    new ResizeObserver(() => this.resize()).observe(host);
    this.loop();
  }

  dragBreaksFollow = true;
  private down = { x: 0, y: 0, t: 0 };
  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  private onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6 || performance.now() - this.down.t > 500) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObject(this.ground)[0];
    if (!hit) return;
    // pick radius grows with zoom so distant dots stay clickable
    const dist = this.camera.position.distanceTo(this.controls.target);
    const a = this.people.pick(this.sim, hit.point.x, hit.point.z, Math.max(3, dist * 0.012));
    this.onPick(a, hit.point);
  };

  focus(x: number, z: number, dist = 120) {
    const t = this.controls.target;
    const off = this.camera.position.clone().sub(t);
    // close up, look down steeply so narrow streets aren't hidden behind tube houses
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.radius = dist;
    sph.phi = Math.min(sph.phi, dist < 150 ? 0.62 : 0.95);
    off.setFromSpherical(sph);
    t.set(x, 0, z);
    this.camera.position.copy(t).add(off);
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.composer.setSize(w, h);
  }

  private lighting() {
    const sim = this.sim;
    const hour = sim.clock.hour;
    const day = daylight(hour);
    const night = 1 - day;
    const rain = sim.weather.rain;
    // sky: night → dawn/dusk glow → day, greyed by rain
    const golden = Math.max(0, 1 - Math.abs(hour - 6.2) / 1.4) + Math.max(0, 1 - Math.abs(hour - 18.3) / 1.4);
    const sky = SKY.night.clone().lerp(SKY.day, day).lerp(SKY.dawn, Math.min(0.75, golden * 0.75)).lerp(SKY.rain, rain * 0.6 * day);
    if (sim.weather.flash > 0) sky.lerp(C("#e8eeff"), sim.weather.flash * 0.7);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(sky);
    // at night the edge of the baked map sinks into darkness instead of ending in a flat plain
    (this.scene.fog as THREE.Fog).far = 3200 - rain * 2000 - night * 1600;
    (this.scene.fog as THREE.Fog).near = 900 - rain * 600 - night * 420;

    const ang = ((hour - 6) / 12) * Math.PI;
    const t = this.controls.target;
    this.sun.position.set(t.x + Math.cos(ang) * 700, Math.max(80, Math.sin(ang) * 900), t.z + 380);
    this.sun.target.position.copy(t);
    this.sun.intensity = day > 0 ? (0.4 + 2.2 * day) * (1 - rain * 0.65) : 0.18;
    this.sun.color.copy(day > 0 ? C("#fff1d6").lerp(C("#ffb26b"), Math.min(1, golden)) : C("#8fa6ff"));
    if (day <= 0) this.sun.position.set(t.x - 400, 700, t.z - 300); // moonlight
    this.hemi.intensity = 0.12 + 0.88 * day + sim.weather.flash * 2.5;
    this.scene.environmentIntensity = 0.04 + 0.3 * day * (1 - rain * 0.5);
    this.hemi.color.copy(C("#2a3a66").lerp(C("#cfe3ff"), day));
    this.renderer.toneMappingExposure = 0.9 + night * 0.1;

    this.u.uNight.value = Math.min(1, night * 1.3);
    this.u.uWet.value = rain;
    // bloom only for genuinely bright things (lamps, fire, lanterns), more at night
    this.bloom.strength = 0.12 + night * 0.55;
    this.bloom.threshold = 0.95 - night * 0.2;

    // street lamps + outage zones
    const key = sim.outages.map((o) => `${o.x},${o.z},${o.r}`).join("|");
    this.lampMat.emissiveIntensity = night > 0.35 ? 2.4 : 0;
    if (key !== this.lastOutKey) {
      this.lastOutKey = key;
      const on = new THREE.Color(1, 1, 1), off = new THREE.Color(0.1, 0.1, 0.1);
      this.lamps.spots.forEach(([x, z], i) => {
        const dark = sim.outages.some((o) => (x - o.x) ** 2 + (z - o.z) ** 2 < o.r * o.r);
        this.lamps.heads.setColorAt(i, dark ? off : on);
      });
      if (this.lamps.heads.instanceColor) this.lamps.heads.instanceColor.needsUpdate = true;
      this.u.uOut.value.forEach((v, i) => {
        const o = sim.outages[i];
        v.set(o?.x ?? 0, o?.z ?? 0, o ? (Number.isFinite(o.r) ? o.r : 1e6) : 0, o ? 1 : 0);
      });
    }
    return night;
  }

  private updateLabels() {
    const sim = this.sim;
    const camD = this.camera.position.distanceTo(this.controls.target);
    for (const r of sim.residents) {
      let L = this.resLabels.get(r.a.id);
      if (!L) {
        const wrap = document.createElement("div");
        wrap.className = "res-label";
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        const name = document.createElement("div");
        name.className = "name";
        wrap.append(bubble, name);
        wrap.style.pointerEvents = "auto";
        wrap.addEventListener("click", () => this.onPick(r.a, new THREE.Vector3(r.a.x, 0, r.a.z)));
        const obj = new CSS2DObject(wrap);
        this.scene.add(obj);
        L = { obj, name, bubble };
        this.resLabels.set(r.a.id, L);
      }
      const visible = r.a.state !== "inside";
      L.obj.visible = visible;
      if (!visible) continue;
      L.obj.position.set(r.a.x, 5.2 * r.a.scale, r.a.z);
      const sel = sim.selected === r.a.id;
      L.name.textContent = `${r.mood} ${r.p.name}`;
      L.name.classList.toggle("sel", sel);
      const speaking = sim.wall < r.sayUntil && r.say;
      L.bubble.textContent = speaking ? r.say : "";
      L.bubble.style.display = speaking && (camD < 700 || sel) ? "block" : "none";
      L.name.style.display = camD < 900 || sel ? "block" : "none";
    }
    const live = new Set<string>();
    for (const ev of sim.events) {
      if (ev.ended || !ev.place) continue;
      live.add(ev.id);
      let o = this.evLabels.get(ev.id);
      if (!o) {
        const el = document.createElement("div");
        el.className = "ev-label";
        el.innerHTML = `<span class="ic">${CATALOG[ev.kind].icon}</span><span></span>`;
        (el.lastChild as HTMLElement).textContent = ev.headline;
        o = new CSS2DObject(el);
        o.position.set(ev.place.x, 34, ev.place.z);
        this.scene.add(o);
        this.evLabels.set(ev.id, o);
      }
    }
    for (const [id, o] of this.evLabels) {
      if (!live.has(id)) {
        this.scene.remove(o);
        o.element.remove();
        this.evLabels.delete(id);
      }
    }
    for (const o of this.lmLabels) o.visible = camD < 1100;
  }

  /**
   * Capture mode: when true the real-time loop stops and the world only moves
   * when `advance(dt)` is called — one exact frame per call, for smooth video
   * capture on any machine (see README "Recording a video").
   */
  manual = false;

  advance(dt = 1 / 30) {
    this.frame(dt);
  }

  private loop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const real = Math.min(this.clock.getDelta(), 0.1);
    if (this.manual) return;
    this.frame(real);
  };

  private frame(dt: number) {
    this.sim.tick(dt);
    this.u.uTime.value += dt;
    const night = this.lighting();
    this.people.update(this.sim, this.sim.paused ? 0 : dt * this.sim.speed, night);
    this.props.update(dt, this.controls.target, night);

    // follow the selected agent
    const sel = this.sim.selected != null ? this.sim.agentById(this.sim.selected) : undefined;
    if (sel !== undefined && this.sim.selected !== this.lastSel) this.follow = true;
    this.lastSel = this.sim.selected;
    if (sel && this.follow && sel.state !== "inside" && sel.state !== "off") {
      const t = this.controls.target;
      const k = 1 - Math.exp(-dt * 4);
      const dx = (sel.x - t.x) * k, dz = (sel.z - t.z) * k;
      t.x += dx;
      t.z += dz;
      this.camera.position.x += dx;
      this.camera.position.z += dz;
    }
    this.controls.update();
    this.updateLabels();
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
