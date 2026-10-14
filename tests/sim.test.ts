import { describe, expect, it } from "vitest";
import { Sim } from "../src/sim/sim";
import { MOCK, testWorld } from "./helpers";

const run = async (sim: Sim, realSeconds: number, speed = 16) => {
  sim.speed = speed;
  for (let t = 0; t < realSeconds; t += 0.05) {
    sim.tick(0.05);
    if (Math.round(t * 20) % 10 === 0) await new Promise((r) => setTimeout(r, 1));
  }
};

describe("sim (mock mind)", () => {
  it("wakes up, fills the streets and keeps everyone on the map", async () => {
    const sim = new Sim(testWorld(), MOCK, { walkers: 200, bikes: 120, mockLatencyMs: 0 });
    await run(sim, 30); // 30 s × 16 × 30 = 4 sim hours
    const out = sim.walkers.filter((a) => a.state !== "inside").length;
    expect(out).toBeGreaterThan(30);
    expect(sim.bikes.filter((b) => b.state === "move").length).toBeGreaterThan(10);
    const half = testWorld().data.meta.half;
    for (const a of sim.agents) {
      expect(Number.isFinite(a.x) && Number.isFinite(a.z)).toBe(true);
      expect(Math.abs(a.x)).toBeLessThan(half.x + 200);
      expect(Math.abs(a.z)).toBeLessThan(half.z + 200);
    }
    expect(sim.residents.every((r) => r.plan.length >= 3)).toBe(true);
    expect(sim.feed.some((f) => f.kind === "thought")).toBe(true);
  });

  it("performs every event kind without crashing", async () => {
    const sim = new Sim(testWorld(), MOCK, { walkers: 150, bikes: 80, mockLatencyMs: 0 });
    await run(sim, 6);
    const prompts = [
      "Cháy lớn ở Hàng Bạc", "Múa lân ở Hồ Gươm", "Mưa to", "Việt Nam vô địch đi bão", "Mất điện ở Hàng Gai",
      "Ngập ở Hàng Bè", "Cấm đường Hàng Đào", "Tắc đường ở Hàng Ngang", "Tàu hỏa qua phố đường tàu",
      "Con trâu xổng ở Chợ Đồng Xuân", "Quay phim ở Nhà thờ Lớn", "Va chạm xe ở Hàng Bạc", "Lễ hội đèn lồng ở Hồ Gươm",
      "Diễu hành ở Đinh Tiên Hoàng", "Giông bão", "Giới nghiêm, mọi người về nhà", "Phát quà miễn phí ở Tạ Hiện",
    ];
    for (const p of prompts) await sim.injectEvent(p);
    expect(sim.events.length).toBe(prompts.length);
    expect(new Set(sim.events.map((e) => e.kind)).size).toBe(17);
    await run(sim, 20);
    const fire = sim.events.find((e) => e.kind === "fire")!;
    expect(fire.fx.truck).toBeTruthy();
    expect(sim.feed.some((f) => /cứu hỏa/.test(f.text))).toBe(true);
    await run(sim, 60, 64);
    expect(sim.events.every((e) => e.ended)).toBe(true);
    expect(sim.actors.length).toBe(0);
    expect(sim.rx.closed.size).toBeGreaterThanOrEqual(0);
  });

  it("closes the lake to traffic on weekend evenings", async () => {
    const sim = new Sim(testWorld(), MOCK, { walkers: 50, bikes: 30, mockLatencyMs: 0 });
    sim.clock.minutes = 6 * 1440 + 18 * 60 + 55; // Saturday 18:55
    await run(sim, 2, 8);
    expect(sim.walkingStreet).toBe(true);
    expect(sim.nightMarket).toBe(true);
    expect(sim.lakeWays.length).toBeGreaterThan(3);
    for (const w of sim.lakeWays) expect(sim.rx.closed.get(w)).toBe("drive");
  });
});

describe("train street", () => {
  it("runs the train past the famous stretch", async () => {
    const sim = new Sim(testWorld(), MOCK, { walkers: 40, bikes: 20, mockLatencyMs: 0 });
    const ev = (await sim.injectEvent("Tàu hỏa chạy qua phố đường tàu"))!;
    const rail = ev.fx.rail as number[];
    const ts = sim.world.landmarks.find((l) => /đường tàu/.test(l.name))!;
    let near = Infinity;
    for (let i = 0; i < rail.length; i += 2) near = Math.min(near, Math.hypot(rail[i] - ts.x, rail[i + 1] - ts.z));
    expect(near).toBeLessThan(40);
    expect(ev.fx.len as number).toBeGreaterThan(300);
  });
});

describe("celebration vs walking street", () => {
  it("bikes take back the lake roads during đi bão", async () => {
    const sim = new Sim(testWorld(), MOCK, { walkers: 40, bikes: 20, mockLatencyMs: 0 });
    sim.clock.minutes = 6 * 1440 + 19 * 60 + 30; // Saturday 19:30, walking street on
    await run(sim, 1, 4);
    expect(sim.rx.closed.get(sim.lakeWays[0])).toBe("drive");
    await sim.injectEvent("Việt Nam vô địch, cả phố đi bão!");
    expect(sim.rx.closed.get(sim.lakeWays[0])).toBeUndefined();
    await run(sim, 8, 4);
    const fans = sim.actors.filter((a) => a.flag && a.kind === "bike");
    expect(fans.filter((a) => a.state === "move").length).toBeGreaterThan(fans.length / 3);
  });
});
