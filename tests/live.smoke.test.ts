// Live smoke test against a real provider. Skipped unless SIM_LIVE=1.
//   SIM_LIVE=1 AI_GATEWAY_API_KEY=... npx vitest run tests/live.smoke.test.ts
import { describe, expect, it } from "vitest";
import { MindRuntime } from "../src/llm/mind";
import { DEFAULT_MODELS } from "../src/llm/pricing";
import type { Settings } from "../src/llm/types";
import { CATALOG, DirectorSchema, directorPrompt, mockDirect } from "../src/sim/events";
import { ChatSchema, PlanSchema, PROFILES, ReactSchema, personaSystem } from "../src/sim/residents";
import { testWorld } from "./helpers";

const live = process.env.SIM_LIVE === "1" && !!process.env.AI_GATEWAY_API_KEY;
const settings: Settings = {
  provider: "gateway",
  apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  baseUrl: "",
  models: { ...DEFAULT_MODELS.gateway, ...(process.env.SIM_MODEL ? { mind: process.env.SIM_MODEL, director: process.env.SIM_MODEL } : {}) },
  budgetUsd: 0.5,
};

describe.skipIf(!live)("live: AI Gateway", () => {
  const w = testWorld();
  const mind = new MindRuntime(settings);
  const log: string[] = [];
  const timed = async <T,>(label: string, f: () => Promise<T>) => {
    const t0 = performance.now();
    const out = await f();
    log.push(`${label}: ${Math.round(performance.now() - t0)} ms`);
    return out;
  };

  it("director maps free text onto the catalogue with real places", async () => {
    const prompts = [
      "Một đàn vịt lạc đường đi nghênh ngang qua Hàng Bạc",
      "Ca sĩ nổi tiếng bất ngờ hát rong ở Hồ Gươm",
      "A sudden hailstorm hits the Old Quarter",
    ];
    for (const p of prompts) {
      const { system, prompt } = directorPrompt(w, p, "vi");
      const out = await timed(`direct "${p.slice(0, 24)}…"`, () =>
        mind.call({ task: "direct", role: "director", system, prompt, schema: DirectorSchema, mock: { out: mockDirect(w, p, "vi") }, priority: 10, maxTokens: 1500 }),
      );
      expect(mind.lastError).toBeNull();
      expect(Object.keys(CATALOG)).toContain(out.kind);
      log.push(`  → ${out.kind} @ ${out.place} | ${out.headline} | props=${out.props.join(",")} | crowd=${out.crowd}`);
      if (!CATALOG[out.kind].global) expect(w.resolvePlace(out.place)).not.toBeNull();
    }
  });

  it("a resident plans, reacts and chats in character", async () => {
    const tu = PROFILES[0], na = PROFILES.find((p) => p.key === "na")!;
    const plan = await timed("plan", () =>
      mind.call({ task: "plan", role: "mind", system: personaSystem(tu, "vi"), prompt: "Bây giờ: 05:30 · Thứ Bảy. Lên kế hoạch hôm nay, 4–7 mốc. Chỉ chọn địa điểm trong: Hàng Bè, Chợ Đồng Xuân, Hồ Gươm, Đền Bạch Mã, Đền Ngọc Sơn.", schema: PlanSchema, mock: { profile: tu, lang: "vi" } }),
    );
    expect(mind.lastError).toBeNull();
    log.push(`  plan: ${plan.thought} | ${plan.plan.map((s) => `${s.time} ${s.place}`).join(" · ")}`);
    const react = await timed("react", () =>
      mind.call({ task: "react", role: "mind", system: personaSystem(tu, "vi"), prompt: "Bây giờ 09:10. Bạn đang bán xôi ở Hàng Bè. VỪA XẢY RA: Cháy lớn ở Phố Hàng Bạc, cách bạn 150 m, khói đen bốc cao. Bạn nghĩ gì, nói gì, làm gì? Nếu đi, chọn place trong: Phố Hàng Bạc, Hàng Bè, Hồ Gươm.", schema: ReactSchema, mock: { profile: tu, lang: "vi", place: "Hàng Bè", activity: "bán xôi" } }),
    );
    expect(mind.lastError).toBeNull();
    log.push(`  react: ${react.mood} ${react.thought} | say="${react.say}" | ${react.action} ${react.place}`);
    const chat = await timed("chat", () =>
      mind.call({ task: "chat", role: "mind", system: "Bạn viết thoại cho hai nhân vật hư cấu gặp nhau trên phố cổ Hà Nội. Ngắn, tự nhiên, có cá tính. Viết bằng tiếng Việt.", prompt: `A = ${tu.name}, ${tu.bio.vi}\nB = ${na.name}, ${na.bio.vi}\nHọ gặp nhau ở Hàng Bè lúc 16:00, vừa có đoàn múa lân đi qua. Viết 2–6 lượt thoại, rồi điều mỗi người nhớ lại.`, schema: ChatSchema, mock: { a: tu, b: na, lang: "vi", where: "Hàng Bè" } }),
    );
    expect(mind.lastError).toBeNull();
    log.push(...chat.lines.map((l) => `  ${l.speaker === "A" ? tu.name : na.name}: ${l.text}`));
    log.push(`meter: ${mind.meter.calls} calls, ${mind.meter.inputTokens} in / ${mind.meter.outputTokens} out, $${mind.meter.usd.toFixed(4)}`);
    console.log(log.join("\n"));
    (globalThis as { __liveLog?: string }).__liveLog = log.join("\n");
    await import("node:fs").then((fs) => fs.writeFileSync(process.env.SIM_LIVE_OUT ?? "/tmp/bmh-sim-live.txt", log.join("\n")));
  });
});
