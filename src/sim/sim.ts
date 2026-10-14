import { MindRuntime } from "../llm/mind";
import type { MockChat, MockPlan, MockReact } from "../llm/mock";
import type { Settings } from "../llm/types";
import { fold, type World } from "../world/world";
import { makeAgent, moveAgent, place, smooth, startTrip, type Agent, type Trip } from "./agent";
import { Clock, daylight, fmtTime, parseHHMM, rng, type Lang, type Rng } from "./core";
import { createBikes, createWalkers, thinkBike, thinkWalker, traffic, type CrowdCtx } from "./crowd";
import { crowdReact, endEvent, eventOverride, startEvent, tickEvent } from "./effects";
import { CATALOG, DirectorSchema, directorPrompt, findPlaceIn, mockDirect, type WorldEvent } from "./events";
import { noRestrictions, type Restrictions } from "./path";
import { ChatSchema, PlanSchema, PROFILES, ReactSchema, personaSystem, type Profile } from "./residents";

/** Models sometimes answer the mood with a word ("lo") — keep only an emoji. */
export function moodOf(s: string | undefined, fallback: string) {
  const m = s?.match(/\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic}|\ufe0f)*/u);
  return m ? m[0] : fallback;
}

export interface FeedItem {
  id: number;
  t: number;
  kind: "event" | "thought" | "say" | "chat" | "system" | "error";
  who?: string;
  whoId?: number;
  icon?: string;
  text: string;
}

export interface PlanStep {
  at: number;
  place: string;
  activity: string;
}

export interface Resident {
  a: Agent;
  p: Profile;
  mood: string;
  thought: string;
  say: string;
  sayUntil: number;
  memory: string[];
  plan: PlanStep[];
  planDay: number;
  stepIdx: number;
  busy: boolean;
  nextThink: number;
  lastChat: Record<string, number>;
  chat: { lines: { r: Resident; text: string }[]; i: number; next: number } | null;
  asleep: boolean;
}

export interface Weather {
  /** 0..1 current, eased toward target */
  rain: number;
  rainTarget: number;
  storm: boolean;
  /** lightning flash 0..1, decays */
  flash: number;
}

export class Sim {
  readonly clock = new Clock();
  readonly rand: Rng;
  rx: Restrictions = noRestrictions();
  speed = 1;
  paused = false;
  lang: Lang = "vi";
  walkers: Agent[];
  bikes: Agent[];
  residents: Resident[] = [];
  actors: Agent[] = [];
  events: WorldEvent[] = [];
  feed: FeedItem[] = [];
  weather: Weather = { rain: 0, rainTarget: 0, storm: false, flash: 0 };
  outages: { x: number; z: number; r: number }[] = [];
  floods: { x: number; z: number; r: number; level: number; target: number }[] = [];
  walkingStreet = false;
  nightMarket = false;
  /** real seconds while not paused — drives speech bubbles */
  wall = 0;
  version = 0;
  selected: number | null = null;
  mind: MindRuntime;
  /** ways closed for the weekend walking street / night market */
  readonly lakeWays: number[];
  readonly marketWays: number[];
  private feedId = 1;
  private meetTimer = 0;
  private crowdTimer = 0;

  constructor(
    readonly world: World,
    settings: Settings,
    opts: { walkers?: number; bikes?: number; seed?: number; mockLatencyMs?: number } = {},
  ) {
    this.rand = rng(opts.seed ?? 20261014);
    this.mind = new MindRuntime(settings, 4, opts.mockLatencyMs);
    this.walkers = createWalkers(world, this.rand, opts.walkers ?? 380);
    this.bikes = createBikes(world, this.rand, opts.bikes ?? 240);
    const lake = new Set(world.lakeNodes);
    this.lakeWays = [];
    world.data.ways.forEach((w, i) => {
      if (["footway", "path", "steps", "pedestrian"].includes(w.k)) return;
      if (w.p.filter((n) => lake.has(n)).length >= 2) this.lakeWays.push(i);
    });
    this.marketWays = [];
    for (const name of ["hang dao", "hang ngang", "dong xuan"]) this.marketWays.push(...(world.streets.get(name)?.ways ?? []));

    for (const p of PROFILES) {
      const home = world.resolvePlace(p.home);
      const node = home?.node ?? world.landmarks[0].node;
      const a = makeAgent({
        kind: "resident",
        role: "resident",
        name: p.name,
        female: p.female,
        age: p.age,
        home: { node, x: world.nx[node], z: world.nz[node] },
        color: p.color,
        hat: p.hat,
        speed: p.age > 65 ? 2.3 : p.age < 12 ? 3.4 : 3,
        scale: p.age < 12 ? 0.75 : 1.05,
        state: "inside",
      });
      this.residents.push({
        a, p, mood: "😴", thought: "", say: "", sayUntil: 0, memory: [], plan: [], planDay: -1, stepIdx: -1,
        busy: false, nextThink: 0, lastChat: {}, chat: null, asleep: true,
      });
    }
    this.log({ kind: "system", icon: "🌅", text: this.lang === "vi" ? "Phố cổ thức giấc." : "The Old Quarter wakes up." });
  }

  get agents(): Agent[] {
    return [...this.walkers, ...this.bikes, ...this.residents.map((r) => r.a), ...this.actors];
  }

  agentById(id: number): Agent | undefined {
    return this.walkers.find((a) => a.id === id) ?? this.bikes.find((a) => a.id === id) ?? this.residents.find((r) => r.a.id === id)?.a ?? this.actors.find((a) => a.id === id);
  }

  residentOf(id: number | null) {
    return id == null ? undefined : this.residents.find((r) => r.a.id === id);
  }

  log(item: Omit<FeedItem, "id" | "t">) {
    this.feed.push({ ...item, id: this.feedId++, t: this.clock.minutes });
    if (this.feed.length > 400) this.feed.splice(0, this.feed.length - 400);
    this.version++;
  }

  // ------------------------------------------------------------ main loop

  tick(realDt: number) {
    realDt = Math.min(realDt, 0.1);
    if (this.paused) return;
    this.wall += realDt;
    const visual = realDt * this.speed;
    const steps = Math.max(1, Math.ceil(visual / 0.25));
    for (let s = 0; s < steps; s++) this.step(realDt / steps, visual / steps);
  }

  private step(realDt: number, dt: number) {
    const before = this.clock.hour;
    this.clock.advance(realDt, this.speed);
    const h = this.clock.hour;
    const minutes = this.clock.minutes;
    this.schedule(before, h);

    // events
    for (const ev of this.events) {
      if (ev.ended) continue;
      if (minutes >= ev.end) {
        endEvent(this, ev);
        ev.ended = true;
        this.rebuildRestrictions();
        this.version++;
      } else tickEvent(this, ev, dt);
    }
    this.crowdTimer += dt;
    if (this.crowdTimer > 20) {
      this.crowdTimer = 0;
      for (const ev of this.events) if (!ev.ended) crowdReact(this, ev, false);
    }

    // weather easing
    const w = this.weather;
    w.rain += (w.rainTarget - w.rain) * Math.min(1, dt * 0.15);
    w.flash = Math.max(0, w.flash - dt * 2.5);
    if (w.storm && this.rand.chance(dt * 0.12)) w.flash = 1;
    for (const f of this.floods) f.level += (f.target - f.level) * Math.min(1, dt * 0.05);

    const ctx: CrowdCtx = {
      world: this.world, rand: this.rand, rx: this.rx, hour: h, weekend: this.clock.weekend, minutes,
      override: (a) => eventOverride(this, a),
    };
    for (const a of this.walkers) {
      thinkWalker(a, ctx);
      if (a.state === "move") {
        const slow = this.floodFactor(a);
        if (moveAgent(this.world, a, dt, this.rx, slow)) this.arrive(a);
        if (a.state === "move" && a.trip && this.weather.rain > 0.25 && !a.umbrella && a.kind === "walker") {
          a.umbrella = (a.id * 7919) % 10 < 7;
        }
      }
      smooth(a, dt);
    }
    let wanted = Math.round(traffic(h) * this.bikes.length * (1 - this.weather.rain * 0.45));
    if (this.events.some((e) => !e.ended && (e.kind === "storm" || e.kind === "quiet"))) wanted = Math.round(wanted * 0.15);
    let active = 0;
    for (const b of this.bikes) if (b.state === "move") active++;
    for (const b of this.bikes) {
      thinkBike(b, ctx, wanted, active);
      if (b.state === "move") {
        if (moveAgent(this.world, b, dt, this.rx, this.floodFactor(b))) this.arrive(b);
      }
      smooth(b, dt);
    }
    for (const a of this.actors) {
      if (a.state === "move" && moveAgent(this.world, a, dt, this.rx, this.floodFactor(a))) this.arrive(a);
      smooth(a, dt);
    }
    this.residentsStep(dt);
  }

  private floodFactor(a: Agent) {
    for (const f of this.floods) {
      if (f.level > 0.1 && (a.x - f.x) ** 2 + (a.z - f.z) ** 2 < f.r * f.r) return a.kind === "bike" ? 0.35 : 0.6;
    }
    return 1;
  }

  arrive(a: Agent) {
    const t = a.trip;
    a.path = null;
    if (!t) {
      a.state = "idle";
      return;
    }
    const m = this.clock.minutes;
    switch (t.then) {
      case "inside":
        a.state = "inside";
        a.until = m + t.dwell;
        a.umbrella = false;
        break;
      case "idle":
        a.state = "idle";
        a.until = m + t.dwell;
        break;
      case "watch":
        a.state = "watch";
        a.until = m + t.dwell;
        if (t.lookX !== undefined && t.lookZ !== undefined) a.heading = Math.atan2(t.lookX - a.x, t.lookZ - a.z);
        break;
      case "despawn":
        a.state = "off";
        a.until = m + this.rand.range(1, 8);
        break;
      case "next":
        a.state = "idle";
        a.until = m;
        break;
    }
    if (a.kind === "resident") {
      const r = this.residentOf(a.id);
      if (r && t.then === "inside") r.asleep = this.clock.hour >= 22.5 || this.clock.hour < 4.5;
    }
  }

  /** current node for re-routing an agent that may be mid-segment */
  nodeOf(a: Agent) {
    if (a.state === "inside") return a.home.node;
    return this.world.nearestNode(a.tx, a.tz, a.kind === "bike");
  }

  /** Send any agent somewhere now. */
  send(a: Agent, trip: Trip): boolean {
    const from = this.nodeOf(a);
    if (a.state === "inside" || a.state === "off") place(a, this.world.nx[from], this.world.nz[from]);
    return startTrip(this.world, a, from, trip, this.rx);
  }

  // ------------------------------------------------------------ schedule

  private schedule(before: number, h: number) {
    const day = this.clock.weekday;
    const weekendEvening = day === 5 || day === 6 || day === 0;
    const ws = weekendEvening && (h >= 19 || h < 0.01);
    const nm = weekendEvening && h >= 18 && h < 23;
    if (ws !== this.walkingStreet) {
      this.walkingStreet = ws;
      this.rebuildRestrictions();
      this.log({ kind: "system", icon: "🚶", text: ws ? (this.lang === "vi" ? "19:00 — Phố đi bộ Hồ Gươm mở, cấm xe quanh hồ." : "19:00 — Hoàn Kiếm walking street opens; no vehicles around the lake.") : this.lang === "vi" ? "Phố đi bộ đóng, xe chạy lại quanh hồ." : "Walking street closes; traffic returns around the lake." });
    }
    if (nm !== this.nightMarket) {
      this.nightMarket = nm;
      this.rebuildRestrictions();
      this.log({ kind: "system", icon: "🏮", text: nm ? (this.lang === "vi" ? "Chợ đêm Hàng Đào – Đồng Xuân bày hàng." : "Hàng Đào – Đồng Xuân night market sets up.") : this.lang === "vi" ? "Chợ đêm dọn hàng." : "The night market packs up." });
    }
    if (before > h) this.log({ kind: "system", icon: "📅", text: this.clock.label(this.lang) });
  }

  rebuildRestrictions() {
    const rx = noRestrictions();
    // during "đi bão" the bikes take the lake roads back, walking street or not
    const celebrating = this.events.some((e) => !e.ended && e.kind === "celebration");
    if (this.walkingStreet && !celebrating) for (const w of this.lakeWays) rx.closed.set(w, "drive");
    if (this.nightMarket) for (const w of this.marketWays) rx.closed.set(w, "drive");
    for (const ev of this.events) {
      if (ev.ended) continue;
      const ways = (ev.fx.ways as number[] | undefined) ?? [];
      if (["festival", "parade", "roadblock", "filming", "fire"].includes(ev.kind)) for (const w of ways) rx.closed.set(w, ev.kind === "roadblock" && ev.intensity > 0.85 ? "all" : "drive");
      if (ev.kind === "jam") for (const w of ways) rx.slow.set(w, 0.12);
      if (ev.kind === "flood") for (const w of ways) rx.slow.set(w, 0.35);
      if (ev.kind === "accident") for (const w of ways) rx.slow.set(w, 0.3);
    }
    this.rx = rx;
  }

  // ------------------------------------------------------------ events

  async injectEvent(text: string, at?: { x: number; z: number }) {
    const t = text.trim();
    if (!t) return;
    this.log({ kind: "system", icon: "🎬", text: this.lang === "vi" ? `Đạo diễn đang dàn dựng: “${t}”…` : `The director is staging: “${t}”…` });
    const fallback = mockDirect(this.world, t, this.lang);
    const { system, prompt } = directorPrompt(this.world, t, this.lang);
    let out = fallback;
    try {
      out = await this.mind.call({ task: "direct", role: "director", system, prompt, schema: DirectorSchema, mock: { out: fallback }, priority: 10, maxTokens: 1500 });
    } catch {
      out = fallback;
    }
    const info = CATALOG[out.kind];
    let where: WorldEvent["place"] = null;
    if (at) {
      const node = this.world.nearestNode(at.x, at.z);
      where = { name: this.streetAt(at.x, at.z) || (this.lang === "vi" ? "điểm đã chọn" : "the chosen spot"), x: at.x, z: at.z, node };
    } else if (!info.global || !/toan khu|whole|entire|all/.test(fold(out.place))) {
      // a place the viewer named outright beats the director's pick
      where = findPlaceIn(this.world, t) ?? this.world.resolvePlace(out.place);
      if (!where && !info.global) {
        const lake = this.world.landmarks[0];
        where = { name: lake.name, x: lake.x, z: lake.z, node: lake.node };
      }
    }
    if (out.kind === "train") {
      const ts = this.world.landmarks.find((l) => /đường tàu/.test(l.name));
      if (ts) where = { name: ts.name, x: ts.x, z: ts.z, node: ts.node };
    }
    const m = this.clock.minutes;
    const ev: WorldEvent = {
      id: `ev${m.toFixed(0)}-${Math.floor(this.rand.next() * 1e6)}`,
      kind: out.kind,
      prompt: t,
      headline: out.headline,
      narration: out.narration,
      place: where,
      radius: info.global && !where ? Infinity : info.radius * (0.7 + out.intensity * 0.6),
      start: m,
      end: m + Math.max(5, out.durationMinutes),
      intensity: out.intensity,
      crowd: out.crowd,
      props: out.props,
      animal: out.animal ?? undefined,
      fx: {},
      actorIds: [],
    };
    this.events.push(ev);
    startEvent(this, ev);
    this.rebuildRestrictions();
    crowdReact(this, ev, true);
    this.log({ kind: "event", icon: info.icon, text: `${ev.headline}${ev.narration ? ` — ${ev.narration}` : ""}` });
    for (const r of this.residents) {
      if (r.a.state === "inside" && r.asleep && !info.global) continue;
      const d = where ? Math.hypot(r.a.x - where.x, r.a.z - where.z) : 0;
      if (info.global || d < Math.max(ev.radius * 4, 420) || r.p.key === "phong") this.react(r, ev, d);
    }
    this.version++;
    return ev;
  }

  stopEvent(id: string) {
    const ev = this.events.find((e) => e.id === id);
    if (ev && !ev.ended) ev.end = this.clock.minutes;
  }

  spawnActor(p: Partial<Agent> & Pick<Agent, "actor" | "name">, ev: WorldEvent, x: number, z: number): Agent {
    const node = this.world.nearestNode(x, z);
    const a = makeAgent({ kind: "actor", role: "actor", home: { node, x, z }, state: "idle", eventId: ev.id, ...p });
    place(a, x, z);
    this.actors.push(a);
    ev.actorIds.push(a.id);
    return a;
  }

  removeActors(ev: WorldEvent) {
    const ids = new Set(ev.actorIds);
    this.actors = this.actors.filter((a) => !ids.has(a.id));
    if (this.selected != null && ids.has(this.selected)) this.selected = null;
  }

  streetAt(x: number, z: number): string {
    const n = this.world.nearestNode(x, z);
    for (const e of this.world.adj[n]) {
      const w = this.world.data.ways[e.way];
      if (w?.n) return w.n;
    }
    return "";
  }

  // ------------------------------------------------------------ residents

  private residentsStep(dt: number) {
    const m = this.clock.minutes;
    const h = this.clock.hour;
    const mod = m % 1440;
    for (const r of this.residents) {
      const a = r.a;
      if (a.state === "move" && moveAgent(this.world, a, dt, this.rx, this.floodFactor(a))) this.arrive(a);
      smooth(a, dt);
      if (r.chat) {
        if (this.wall >= r.chat.next) {
          const line = r.chat.lines[r.chat.i];
          if (line) {
            line.r.say = line.text;
            line.r.sayUntil = this.wall + 4;
            r.chat.i++;
            r.chat.next = this.wall + 3.2;
            this.version++;
          } else {
            const partner = r.chat.lines.find((l) => l.r !== r)?.r;
            r.chat = null;
            this.resume(r);
            if (partner) this.resume(partner);
          }
        }
        continue;
      }
      if (r.busy) continue;
      if (r.planDay !== this.clock.dayIndex && h >= 4) {
        this.requestPlan(r);
        continue;
      }
      // bedtime
      if ((h >= 23 || h < 4.5) && !r.asleep) {
        if (a.state !== "move" || a.trip?.then !== "inside") {
          this.goTo(r, r.p.home, this.lang === "vi" ? "đi ngủ" : "going to bed", "inside", 400);
          r.mood = "😴";
        }
        continue;
      }
      if (r.asleep && h >= 4.5 && h < 23 && r.planDay === this.clock.dayIndex) r.asleep = false;
      if (r.asleep) continue;
      // follow the plan
      let idx = -1;
      for (let i = 0; i < r.plan.length; i++) if (r.plan[i].at <= mod) idx = i;
      if (idx >= 0 && idx !== r.stepIdx && a.state !== "watch") {
        r.stepIdx = idx;
        const s = r.plan[idx];
        this.goTo(r, s.place, s.activity, "idle", 600);
      }
      if (m >= r.nextThink && a.state !== "move") {
        r.nextThink = m + this.rand.range(70, 130);
        this.react(r, null, 0);
      }
    }
    this.meetTimer += dt;
    if (this.meetTimer > 1.5) {
      this.meetTimer = 0;
      this.meetings();
    }
  }

  private resume(r: Resident) {
    r.busy = false;
    const s = r.plan[r.stepIdx];
    if (s && r.a.state !== "inside") this.goTo(r, s.place, s.activity, "idle", 600);
  }

  goTo(r: Resident, placeName: string, activity: string, then: Trip["then"] = "idle", dwell = 120) {
    const target = this.world.resolvePlace(placeName) ?? this.world.resolvePlace(r.p.home);
    if (!target) return;
    // land beside the spot, not in the same pixel as everyone else
    const nodes = this.world.nodesWithin(target.x, target.z, 35);
    const node = nodes.length ? nodes[r.p.key.charCodeAt(0) % nodes.length] : target.node;
    const ok = this.send(r.a, { node, label: activity, then, dwell });
    if (!ok) r.a.errand = activity;
  }

  private planCandidates(r: Resident): string[] {
    const near = this.world.data.pois
      .filter((p) => p.n && ["food", "cafe", "market", "temple", "sight", "culture", "bar"].includes(p.c))
      .map((p) => ({ p, d: Math.hypot(p.x - r.a.home.x, p.z - r.a.home.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 14)
      .map(({ p }) => p.n);
    return [...new Set([r.p.home, r.p.work, ...this.world.landmarks.map((l) => l.name), ...near])];
  }

  private situation(r: Resident) {
    const street = this.streetAt(r.a.x, r.a.z);
    const rain = this.weather.rain > 0.2 ? (this.lang === "vi" ? "đang mưa" : "raining") : this.lang === "vi" ? "khô ráo" : "dry";
    const plan = r.plan.map((s) => `${fmtTime(s.at)} ${s.place}: ${s.activity}`).join("; ");
    const mem = r.memory.slice(-6).join(" | ") || "—";
    const nearby = this.residents
      .filter((o) => o !== r && o.a.state !== "inside" && Math.hypot(o.a.x - r.a.x, o.a.z - r.a.z) < 60)
      .map((o) => o.p.name)
      .join(", ");
    const active = this.events.filter((e) => !e.ended).map((e) => `${e.headline}${e.place ? ` (${e.place.name})` : ""}`).join("; ");
    return (
      `Bây giờ: ${this.clock.label("vi")}. Thời tiết: ${rain}. Bạn đang ở ${street || "phố cổ"}, ${String(r.a.errand)}.\n` +
      `Kế hoạch hôm nay: ${plan || "chưa có"}.\nKý ức gần đây: ${mem}.\n` +
      `Người quen gần đây: ${nearby || "không ai"}.\nChuyện đang xảy ra trong phố: ${active || "không có gì đặc biệt"}.`
    );
  }

  private requestPlan(r: Resident) {
    r.busy = true;
    r.planDay = this.clock.dayIndex;
    const cands = this.planCandidates(r);
    const prompt =
      `${this.situation(r)}\n\nLên kế hoạch cho phần còn lại của ngày hôm nay (${this.clock.weekend ? "cuối tuần" : "ngày thường"}), 4–7 mốc giờ, theo thói quen của bạn.\n` +
      `Chỉ chọn địa điểm trong danh sách: ${cands.join(", ")}.`;
    this.mind
      .call({ task: "plan", role: "mind", system: personaSystem(r.p, this.lang), prompt, schema: PlanSchema, mock: { profile: r.p, lang: this.lang } satisfies MockPlan, priority: 3 })
      .then((out) => {
        r.plan = out.plan
          .map((s) => ({ at: parseHHMM(s.time) ?? -1, place: s.place, activity: s.activity }))
          .filter((s) => s.at >= 0)
          .sort((a, b) => a.at - b.at);
        r.stepIdx = -1;
        r.mood = moodOf(out.mood, "🙂");
        r.thought = out.thought;
        r.asleep = false;
        this.log({ kind: "thought", who: r.p.name, whoId: r.a.id, icon: r.mood, text: out.thought });
      })
      .catch(() => {})
      .finally(() => {
        r.busy = false;
        this.version++;
      });
  }

  react(r: Resident, ev: WorldEvent | null, dist: number) {
    if (r.busy || r.chat) return;
    r.busy = true;
    const cands = this.planCandidates(r);
    const evText = ev
      ? `VỪA XẢY RA: ${ev.headline}. ${ev.narration} Địa điểm: ${ev.place?.name ?? "cả khu phố cổ"}${ev.place ? `, cách bạn khoảng ${Math.round(dist)} m` : ""}.`
      : "Không có gì đặc biệt, chỉ là một khoảnh khắc trong ngày.";
    const prompt =
      `${this.situation(r)}\n\n${evText}\n\nBạn nghĩ gì, có nói gì không, và làm gì tiếp? ` +
      `Nếu đi đâu, chọn place trong: ${[...(ev?.place ? [ev.place.name] : []), ...cands].join(", ")}.`;
    const mock: MockReact = {
      profile: r.p, lang: this.lang, place: this.streetAt(r.a.x, r.a.z), activity: String(r.a.errand),
      event: ev ? { kind: ev.kind, headline: ev.headline, place: ev.place?.name, near: dist < Math.max(ev.radius * 4, 420) } : undefined,
    };
    this.mind
      .call({ task: "react", role: "mind", system: personaSystem(r.p, this.lang), prompt, schema: ReactSchema, mock, priority: ev ? 6 : 1 })
      .then((out) => {
        r.mood = moodOf(out.mood, r.mood);
        r.thought = out.thought;
        this.log({ kind: "thought", who: r.p.name, whoId: r.a.id, icon: r.mood, text: out.thought });
        if (out.say) {
          r.say = out.say;
          r.sayUntil = this.wall + 5;
        }
        if (ev) r.memory.push(`${fmtTime(this.clock.minutes)} ${ev.headline}`);
        if (r.memory.length > 14) r.memory.shift();
        switch (out.action) {
          case "go": {
            const toEvent = ev?.place && (fold(out.place).includes(fold(ev.place.name)) || !out.place);
            if (toEvent && ev?.place) {
              const ring = this.world.nodesWithin(ev.place.x, ev.place.z, Math.max(30, Math.min(ev.radius, 120))).filter((n) => Math.hypot(this.world.nx[n] - ev.place!.x, this.world.nz[n] - ev.place!.z) > ev.radius * 0.4);
              const node = ring.length ? this.rand.pick(ring) : ev.place.node;
              this.send(r.a, { node, label: out.activity || "watch", then: "watch", dwell: Math.max(10, ev.end - this.clock.minutes), lookX: ev.place.x, lookZ: ev.place.z });
            } else if (out.place) this.goTo(r, out.place, out.activity, "idle", 90);
            break;
          }
          case "go_home":
            this.goTo(r, r.p.home, out.activity || (this.lang === "vi" ? "về nhà" : "heading home"), "inside", 120);
            break;
          case "stay":
            if (r.a.state === "move") {
              r.a.path = null;
              r.a.state = "idle";
              r.a.until = this.clock.minutes + 30;
            }
            r.a.errand = out.activity || r.a.errand;
            break;
          default:
            if (out.activity && r.a.state !== "move") r.a.errand = out.activity;
        }
      })
      .catch(() => {})
      .finally(() => {
        r.busy = false;
        this.version++;
      });
  }

  private meetings() {
    const m = this.clock.minutes;
    const rs = this.residents;
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const A = rs[i], B = rs[j];
        if (A.busy || B.busy || A.chat || B.chat) continue;
        if (A.a.state === "inside" || B.a.state === "inside") continue;
        if (Math.hypot(A.a.x - B.a.x, A.a.z - B.a.z) > 14) continue;
        if ((A.lastChat[B.p.key] ?? -1e9) > m - 240) continue;
        const known = B.p.key in A.p.knows || A.p.key in B.p.knows;
        A.lastChat[B.p.key] = B.lastChat[A.p.key] = m;
        if (!known && !this.rand.chance(0.35)) continue;
        this.chat(A, B);
        return;
      }
    }
  }

  private chat(A: Resident, B: Resident) {
    A.busy = B.busy = true;
    for (const r of [A, B]) {
      if (r.a.state === "move") {
        r.a.path = null;
        r.a.state = "idle";
      }
      r.a.until = this.clock.minutes + 30;
    }
    A.a.heading = Math.atan2(B.a.x - A.a.x, B.a.z - A.a.z);
    B.a.heading = Math.atan2(A.a.x - B.a.x, A.a.z - B.a.z);
    const where = this.streetAt(A.a.x, A.a.z);
    const relA = A.p.knows[B.p.key]?.vi ?? "người lạ";
    const relB = B.p.knows[A.p.key]?.vi ?? "người lạ";
    const system =
      `Bạn viết thoại cho hai nhân vật hư cấu gặp nhau trên phố cổ Hà Nội. Ngắn, tự nhiên, có cá tính, nhắc chuyện cụ thể đang xảy ra. ` +
      (this.lang === "vi" ? "Viết bằng tiếng Việt, giọng Hà Nội." : "Write in English; keep Vietnamese names.");
    const prompt =
      `A = ${A.p.name}, ${A.p.age} tuổi, ${A.p.job.vi}. ${A.p.bio.vi} (với B: ${relA}). Ký ức: ${A.memory.slice(-4).join(" | ") || "—"}. Đang: ${String(A.a.errand)}.\n` +
      `B = ${B.p.name}, ${B.p.age} tuổi, ${B.p.job.vi}. ${B.p.bio.vi} (với A: ${relB}). Ký ức: ${B.memory.slice(-4).join(" | ") || "—"}. Đang: ${String(B.a.errand)}.\n` +
      `Họ gặp nhau ở ${where || "phố cổ"} lúc ${this.clock.label("vi")}. ${this.situation(A).split("\n").pop()}\n` +
      `Viết 2–6 lượt thoại, rồi điều mỗi người nhớ lại.`;
    this.mind
      .call({ task: "chat", role: "mind", system, prompt, schema: ChatSchema, mock: { a: A.p, b: B.p, lang: this.lang, where } satisfies MockChat, priority: 4 })
      .then((out) => {
        const lines = out.lines.map((l) => ({ r: l.speaker === "A" ? A : B, text: l.text }));
        A.chat = { lines, i: 0, next: this.wall };
        A.memory.push(out.memoryA);
        B.memory.push(out.memoryB);
        this.log({ kind: "chat", icon: "💬", who: `${A.p.name} & ${B.p.name}`, whoId: A.a.id, text: lines.map((l) => `${l.r.p.name}: ${l.text}`).join("\n") });
      })
      .catch(() => {
        A.busy = B.busy = false;
      });
  }

  // ------------------------------------------------------------ view helpers

  get night() {
    return 1 - daylight(this.clock.hour);
  }

  setLang(l: Lang) {
    this.lang = l;
    this.version++;
  }
}
