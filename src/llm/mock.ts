import type { Lang } from "../sim/core";
import type { Profile } from "../sim/residents";
import type { LLMRequest, Provider } from "./providers/types";

/**
 * Offline provider. Deterministic-ish, zero network. Each task receives its
 * context through `req.mock` and answers with JSON in the same shape a real
 * model would, so the whole pipeline (validation included) is exercised.
 */
export interface MockPlan { profile: Profile; lang: Lang }
export interface MockReact { profile: Profile; lang: Lang; event?: { kind: string; headline: string; place?: string; near: boolean }; place: string; activity: string }
export interface MockChat { a: Profile; b: Profile; lang: Lang; where: string }
export interface MockDirect { out: unknown }

let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

const REACT: Record<string, { vi: string[]; en: string[]; go: boolean }> = {
  fire: { vi: ["Trời ơi cháy ở {p}! Có ai gọi 114 chưa?", "Khói đen kìa, {p} cháy rồi!"], en: ["Fire on {p}! Has anyone called 114?", "Black smoke — {p} is burning!"], go: true },
  rain: { vi: ["Mưa rồi, phải tìm chỗ trú.", "Lại mưa, may mà mang áo mưa."], en: ["Rain — need to find shelter.", "Raining again, glad I brought a poncho."], go: false },
  storm: { vi: ["Giông to quá, về nhà thôi.", "Sấm to thế này thì ở nhà cho lành."], en: ["Big storm, time to go home.", "Thunder like that — better stay in."], go: false },
  festival: { vi: ["Có lễ hội ở {p}, ra xem cho vui!", "Nghe nhạc từ {p}, đi thôi!"], en: ["A festival at {p} — let's go see!", "Music from {p}, come on!"], go: true },
  lion_dance: { vi: ["Múa lân! Tiếng trống ở {p} kìa!", "Lân về {p} rồi, ra xem đi!"], en: ["Lion dance! Hear the drums at {p}!", "The lions are at {p}, come watch!"], go: true },
  celebration: { vi: ["Thắng rồi! Ra hồ đi bão thôi!", "Cả phố đổ ra hồ, vui quá!"], en: ["We won! Everyone to the lake!", "The whole quarter is pouring onto the lake!"], go: true },
  outage: { vi: ["Mất điện rồi, bật đèn điện thoại lên.", "Lại cúp điện, nóng quá."], en: ["Power's out, phone torch on.", "Another power cut, it's so hot."], go: false },
  flood: { vi: ["Nước ngập tới bắp chân ở {p}.", "Ngập thế này xe chết máy hết."], en: ["Water up to the calves on {p}.", "Bikes will stall in this flood."], go: false },
  train: { vi: ["Tàu sắp qua! Đứng sát vào tường.", "Tiếng còi tàu, nhanh lên chụp ảnh!"], en: ["Train coming! Stand against the wall.", "The horn! Quick, get the shot!"], go: true },
  animal: { vi: ["Con gì xổng ra ở {p} kìa!", "Ai bắt hộ con vật kia với!"], en: ["Something's loose on {p}!", "Someone catch that animal!"], go: true },
  default: { vi: ["Có chuyện gì ở {p} thế nhỉ?", "Đông người ở {p}, ra xem sao."], en: ["What's going on at {p}?", "A crowd at {p}, let's see."], go: true },
};

export function createMockProvider(latencyMs = 250): Provider {
  return {
    id: "mock",
    async complete(req: LLMRequest) {
      await new Promise((r) => setTimeout(r, latencyMs * (0.5 + rnd())));
      return { text: JSON.stringify(answer(req)), usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}

function answer(req: LLMRequest): unknown {
  switch (req.task) {
    case "ping":
      return { ok: true };
    case "direct":
      return (req.mock as MockDirect).out;
    case "plan": {
      const { profile: p, lang } = req.mock as MockPlan;
      return {
        mood: pick(["🙂", "😊", "😌", "🤔"]),
        thought: pick(p.voice[lang]),
        plan: p.day.map(([time, place, act]) => ({ time, place, activity: act[lang] })),
      };
    }
    case "react": {
      const m = req.mock as MockReact;
      if (m.event) {
        const r = REACT[m.event.kind] ?? REACT.default;
        const line = pick(r[m.lang]).replace("{p}", m.event.place ?? (m.lang === "vi" ? "phố" : "the street"));
        const curious = m.profile.age < 40 || m.profile.key === "phong";
        const go = r.go && m.event.near && m.event.place && (curious || rnd() < 0.4);
        const home = m.event.kind === "storm" || m.event.kind === "quiet";
        return {
          mood: home ? "😟" : go ? "😮" : "🤔",
          thought: line,
          say: rnd() < 0.6 ? line : "",
          action: home ? "go_home" : go ? "go" : "continue",
          place: go ? m.event.place : "",
          activity: go ? (m.lang === "vi" ? "ra xem" : "go and look") : m.activity,
        };
      }
      const t = pick(m.profile.voice[m.lang]);
      return { mood: pick(["🙂", "😌", "🙃", "😊"]), thought: t, say: rnd() < 0.25 ? t : "", action: "continue", place: "", activity: m.activity };
    }
    case "chat": {
      const { a, b, lang } = req.mock as MockChat;
      const vi = [
        { speaker: "A", text: `Ơ ${b.name}! Hôm nay thế nào?` },
        { speaker: "B", text: `${pick(b.voice.vi)}` },
        { speaker: "A", text: `${pick(a.voice.vi)}` },
        { speaker: "B", text: "Thôi, hẹn gặp lại nhé!" },
      ];
      const en = [
        { speaker: "A", text: `Oh, ${b.name}! How's your day?` },
        { speaker: "B", text: `${pick(b.voice.en)}` },
        { speaker: "A", text: `${pick(a.voice.en)}` },
        { speaker: "B", text: "Well, see you around!" },
      ];
      return {
        lines: lang === "vi" ? vi : en,
        memoryA: lang === "vi" ? `Gặp ${b.name} trên phố, nói chuyện dăm câu.` : `Ran into ${b.name}, chatted a bit.`,
        memoryB: lang === "vi" ? `Gặp ${a.name} trên phố, nói chuyện dăm câu.` : `Ran into ${a.name}, chatted a bit.`,
      };
    }
  }
}
