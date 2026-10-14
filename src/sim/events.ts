import { z } from "zod";
import { fold, type World } from "../world/world";
import type { Lang } from "./core";

/**
 * Event kinds the world knows how to *perform*. Each has prepared assets and
 * crowd rules (see effects.ts + render/props.ts). The director maps any free
 * text onto one of these, so "a dragon eats Hàng Bạc" still lands somewhere
 * sensible (crowd + props + narration) instead of failing.
 */
export const EVENT_KINDS = [
  "rain", "storm", "fire", "festival", "lion_dance", "parade", "celebration", "outage",
  "flood", "roadblock", "jam", "train", "animal", "filming", "accident", "crowd", "quiet",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const CROWD_MODES = ["gather", "flee", "shelter", "avoid", "celebrate", "ignore", "go_home"] as const;
export type CrowdMode = (typeof CROWD_MODES)[number];

export const PROPS = [
  "barrier", "lantern", "stage", "tent", "fireworks", "flags", "police", "ambulance", "firetruck",
  "camera", "balloons", "smoke", "fire", "spotlight", "banner", "confetti",
] as const;
export type PropKind = (typeof PROPS)[number];

export const ANIMALS = ["buffalo", "dog", "chicken"] as const;

interface KindInfo {
  icon: string;
  vi: string;
  en: string;
  /** what the director sees */
  desc: string;
  radius: number;
  duration: number;
  crowd: CrowdMode;
  props: PropKind[];
  global?: boolean;
  keywords: RegExp;
}

export const CATALOG: Record<EventKind, KindInfo> = {
  rain: { icon: "🌧️", vi: "Mưa", en: "Rain", desc: "mưa (cả khu): ô dù bung ra, người trú mưa, đường ướt", radius: Infinity, duration: 60, crowd: "shelter", props: [], global: true, keywords: /mưa|troi mua|mua to|mua rao|mua phun|mua lon|rain|drizzle/ },
  storm: { icon: "⛈️", vi: "Giông bão", en: "Storm", desc: "giông bão (cả khu): mưa to, sấm chớp, gió, mọi người về nhà", radius: Infinity, duration: 50, crowd: "go_home", props: [], global: true, keywords: /bão|giông|sấm|sét|giong bao|sam set|con bao|storm|thunder|typhoon|lightning/ },
  fire: { icon: "🔥", vi: "Hỏa hoạn", en: "Fire", desc: "cháy một ngôi nhà: lửa, khói, xe cứu hỏa tới, người gần chạy, người xa đứng xem", radius: 60, duration: 45, crowd: "gather", props: ["fire", "smoke", "firetruck", "barrier"], keywords: /cháy|hỏa hoạn|hoả hoạn|lửa|bốc khói|chay nha|hoa hoan|fire|burn|smoke/ },
  festival: { icon: "🏮", vi: "Lễ hội", en: "Festival", desc: "lễ hội: đèn lồng, sân khấu, âm nhạc, phố đi bộ, đám đông kéo tới", radius: 90, duration: 180, crowd: "gather", props: ["lantern", "stage", "spotlight", "banner"], keywords: /le hoi|den long|trung thu|tet|festival|lantern|concert|hoa nhac|bieu dien|am nhac|music/ },
  lion_dance: { icon: "🦁", vi: "Múa lân", en: "Lion dance", desc: "đoàn múa lân đi dọc phố với trống, trẻ con chạy theo", radius: 50, duration: 60, crowd: "gather", props: ["flags"], keywords: /múa lân|múa rồng|mua lan|mua rong|su tu|lion|dragon dance/ },
  parade: { icon: "🎌", vi: "Diễu hành", en: "Parade", desc: "đoàn diễu hành cầm cờ đi dọc một tuyến phố, đường cấm xe", radius: 50, duration: 60, crowd: "gather", props: ["flags", "barrier", "banner"], keywords: /dieu hanh|duyet binh|parade|march|tuan hanh|biểu tình|bieu tinh|protest/ },
  celebration: { icon: "🇻🇳", vi: "Đi bão", en: "Street celebration", desc: "ăn mừng (vd: thắng bóng đá): hàng trăm xe máy cầm cờ chạy vòng hồ, bóp còi, pháo sáng", radius: 200, duration: 90, crowd: "celebrate", props: ["flags", "fireworks"], keywords: /di bao|bong da|vo dich|chien thang|an mung|world cup|aff|sea games|win|victory|celebrat/ },
  outage: { icon: "🔌", vi: "Mất điện", en: "Power cut", desc: "mất điện: đèn nhà và đèn đường tắt, người bật đèn điện thoại", radius: 220, duration: 60, crowd: "ignore", props: [], keywords: /mat dien|cup dien|power|blackout|outage/ },
  flood: { icon: "🌊", vi: "Ngập lụt", en: "Flood", desc: "ngập nước trên phố: xe chết máy, người lội nước", radius: 160, duration: 120, crowd: "avoid", props: [], keywords: /ngap|lut|flood|nuoc dang|trieu cuong/ },
  roadblock: { icon: "🚧", vi: "Cấm đường", en: "Road closed", desc: "chặn/cấm một tuyến phố: rào chắn, công an phân luồng, xe đi đường khác", radius: 40, duration: 120, crowd: "avoid", props: ["barrier", "police"], keywords: /cam duong|chan duong|phong toa|rào chắn|quây rào|rao chan|sua duong|dao duong|road ?block|closed|closure|construction/ },
  jam: { icon: "🛵", vi: "Tắc đường", en: "Traffic jam", desc: "tắc đường: xe máy dồn ứ, nhích từng chút", radius: 120, duration: 60, crowd: "ignore", props: [], keywords: /tac|ket xe|un tac|jam|traffic|gridlock/ },
  train: { icon: "🚂", vi: "Tàu qua phố", en: "Train passing", desc: "tàu hỏa chạy qua phố đường tàu, người dạt sát tường, du khách chụp ảnh", radius: 40, duration: 8, crowd: "gather", props: [], keywords: /tau hoa|tau qua|doan tau|duong tau|train|railway/ },
  animal: { icon: "🐃", vi: "Thú sổng", en: "Loose animal", desc: "con vật xổng (trâu/chó/gà) chạy lung tung trên phố, người đuổi theo", radius: 70, duration: 40, crowd: "gather", props: [], keywords: /trâu|bò|chó|gà|mèo|khỉ|ngựa|voi|con trau|con bo|con cho|con ga|xong chuong|buffalo|cow|dog|chicken|animal|horse|elephant|monkey/ },
  filming: { icon: "🎬", vi: "Quay phim", en: "Film shoot", desc: "đoàn quay phim / người nổi tiếng: máy quay, đèn, fan tụ tập", radius: 40, duration: 90, crowd: "gather", props: ["camera", "spotlight", "tent", "barrier"], keywords: /quay phim|ca si|dien vien|nguoi noi tieng|idol|celebrity|film|movie|shoot|mv|tiktok|livestream/ },
  accident: { icon: "🚑", vi: "Va chạm", en: "Accident", desc: "va chạm giao thông nhỏ: hai xe đổ, xe cấp cứu, người hiếu kỳ xúm lại", radius: 35, duration: 30, crowd: "gather", props: ["ambulance", "police"], keywords: /tai nan|va cham|dam xe|do xe|accident|crash|collision/ },
  crowd: { icon: "👥", vi: "Tụ tập", en: "Gathering", desc: "bất kỳ chuyện gì khiến người ta tò mò tụ lại xem (mặc định khi không khớp loại nào)", radius: 50, duration: 45, crowd: "gather", props: ["balloons"], keywords: /tu tap|dam dong|crowd|gather|flash ?mob|khai truong|opening|giveaway|phat qua/ },
  quiet: { icon: "🌙", vi: "Giãn cách", en: "Curfew", desc: "mọi người về nhà, phố vắng (giới nghiêm, cảnh báo, giãn cách)", radius: Infinity, duration: 90, crowd: "go_home", props: [], global: true, keywords: /gian cach|gioi nghiem|curfew|lockdown|ve nha|cach ly|quarantine|o nha/ },
};

export const DirectorSchema = z.object({
  kind: z.enum(EVENT_KINDS),
  place: z.string().describe("Tên phố hoặc địa danh lấy từ danh sách; 'toàn khu' nếu ảnh hưởng cả phố cổ"),
  durationMinutes: z.number().min(5).max(600),
  intensity: z.number().min(0).max(1),
  crowd: z.enum(CROWD_MODES),
  props: z.array(z.enum(PROPS)).max(6),
  animal: z.enum(ANIMALS).nullable().optional(),
  headline: z.string().max(140).describe("Tít bản tin ngắn, giọng báo địa phương"),
  narration: z.string().max(400).describe("2 câu mô tả cảnh tượng trên phố"),
});
export type DirectorOut = z.infer<typeof DirectorSchema>;

export interface WorldEvent {
  id: string;
  kind: EventKind;
  prompt: string;
  headline: string;
  narration: string;
  place: { name: string; x: number; z: number; node: number; street?: string } | null;
  radius: number;
  start: number;
  end: number;
  intensity: number;
  crowd: CrowdMode;
  props: PropKind[];
  animal?: (typeof ANIMALS)[number];
  /** runtime state owned by effects.ts */
  fx: Record<string, number | boolean | number[]>;
  actorIds: number[];
  ended?: boolean;
}

export function directorPrompt(world: World, text: string, lang: Lang) {
  const kinds = EVENT_KINDS.map((k) => `- ${k}: ${CATALOG[k].desc}`).join("\n");
  const places = world.placeNames().slice(0, 140).join(", ");
  const system =
    "Bạn là đạo diễn của một mô phỏng phố cổ Hà Nội. Người xem gõ một sự kiện bằng lời; bạn chuyển nó thành một sự kiện mà thế giới diễn được. " +
    "Chọn loại gần nhất trong danh mục, chọn địa điểm có thật trong danh sách, chọn đạo cụ phù hợp. Không bịa tên phố không có trong danh sách. " +
    "Nếu yêu cầu bạo lực, thù hằn hay nhắm vào người thật, hãy biến nó thành một sự kiện 'crowd' vô hại và trung tính.";
  const prompt =
    `Sự kiện người xem nhập: """${text.slice(0, 500)}"""\n\nDanh mục loại sự kiện:\n${kinds}\n\n` +
    `Đạo cụ có sẵn: ${PROPS.join(", ")}\nĐộng vật có sẵn: ${ANIMALS.join(", ")}\n\n` +
    `Địa điểm có thật: ${places}\n\nViết headline và narration bằng ${lang === "vi" ? "tiếng Việt" : "English"}.`;
  return { system, prompt };
}

/**
 * Find a known place mentioned anywhere in free text (longest match wins).
 * Accented text is matched first: folding diacritics makes "rào chắn cấm"
 * contain "chan cam" (Phố Chân Cầm). Folded matching is the fallback for
 * people who type without accents.
 */
export function findPlaceIn(world: World, text: string) {
  const strip = (s: string) => s.normalize("NFC").toLowerCase().replace(/^(phố|đường|ngõ|ngách|cầu)\s+/, "").trim();
  const passes: [(s: string) => string, string][] = [
    [strip, text.normalize("NFC").toLowerCase()],
    [(s) => fold(s).replace(/^(pho|duong|ngo|ngach|cau)\s+/, ""), fold(text)],
  ];
  for (const [norm, q] of passes) {
    let best: ReturnType<World["resolvePlace"]> = null;
    let bestLen = 0;
    for (const l of world.landmarks) {
      const k = norm(l.name);
      if (k.length >= 4 && q.includes(k) && k.length > bestLen) {
        best = { name: l.name, x: l.x, z: l.z, node: l.node };
        bestLen = k.length;
      }
    }
    for (const s of world.streets.values()) {
      const k = norm(s.name);
      if (k.length >= 5 && q.includes(k) && k.length > bestLen) {
        const mid = s.nodes[Math.floor(s.nodes.length / 2)];
        best = { name: s.name, x: world.nx[mid], z: world.nz[mid], node: mid, street: s.name };
        bestLen = k.length;
      }
    }
    if (best) return best;
  }
  if (/ho guom|ho hoan kiem|bo ho|lake/.test(fold(text))) {
    const l = world.landmarks.find((x) => x.kind === "lake");
    if (l) return { name: l.name, x: l.x, z: l.z, node: l.node };
  }
  return null;
}

/** Specific multi-word kinds first: "đi bão" is a celebration, not a storm; "múa lân" is not rain. */
const MATCH_ORDER: EventKind[] = ["train", "lion_dance", "celebration", "fire", "festival", "parade", "outage", "flood", "roadblock", "jam", "accident", "filming", "animal", "quiet", "storm", "rain", "crowd"];

/** Offline director: keyword rules. Also the fallback when the LLM call fails. */
export function mockDirect(world: World, text: string, lang: Lang): DirectorOut {
  const q = ` ${fold(text)} `;
  const both = ` ${text.toLowerCase()} ${q} `;
  let kind: EventKind = "crowd";
  for (const k of MATCH_ORDER) {
    if (CATALOG[k].keywords.test(both)) {
      kind = k;
      break;
    }
  }
  const info = CATALOG[kind];
  const p = findPlaceIn(world, text);
  const animal = /trau|buffalo| bo |cow/.test(q) ? "buffalo" : / ga |chicken/.test(q) ? "chicken" : "dog";
  const where = p?.name ?? (info.global ? (lang === "vi" ? "toàn phố cổ" : "the whole Old Quarter") : lang === "vi" ? "phố cổ" : "the Old Quarter");
  const headline = lang === "vi" ? `${info.vi} ở ${where}` : `${info.en} in ${where}`;
  const narration = lang === "vi" ? `Người dân ${where} xôn xao: "${text.trim().slice(0, 120)}".` : `Word spreads through ${where}: "${text.trim().slice(0, 120)}".`;
  return {
    kind,
    place: p?.name ?? "toàn khu",
    durationMinutes: info.duration,
    intensity: /to|lon|du doi|nghiem trong|massive|huge|heavy|big/.test(q) ? 0.9 : 0.6,
    crowd: info.crowd,
    props: info.props,
    animal: kind === "animal" ? animal : null,
    headline,
    narration,
  };
}
