export type Lang = "vi" | "en";

/** mulberry32 — small, fast, seedable. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof rng>;

/** Real seconds → sim seconds at 1×. A full day is 48 real minutes. */
export const SIM_SECONDS_PER_REAL_SECOND = 30;

export const DAY_NAMES: Record<Lang, string[]> = {
  vi: ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

/** Sim time in minutes since Sunday 00:00 of week 0. */
export class Clock {
  constructor(public minutes = 6 * 24 * 60 + 5 * 60 + 30) {} // Saturday 05:30

  advance(realDt: number, speed: number) {
    this.minutes += (realDt * speed * SIM_SECONDS_PER_REAL_SECOND) / 60;
  }
  get hour() {
    return (this.minutes / 60) % 24;
  }
  get weekday() {
    return Math.floor(this.minutes / 1440) % 7;
  }
  get dayIndex() {
    return Math.floor(this.minutes / 1440);
  }
  get weekend() {
    const d = this.weekday;
    return d === 5 || d === 6 || d === 0;
  }
  label(lang: Lang) {
    return `${fmtTime(this.minutes)} · ${DAY_NAMES[lang][this.weekday]}`;
  }
}

export function fmtTime(minutes: number) {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "07:30" → minutes of day */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2})[:h](\d{2})?$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2] ?? 0);
  if (h > 24 || mm > 59) return null;
  return h * 60 + mm;
}

/** Daylight 0 (night) → 1 (noon), with dawn/dusk ramps. */
export function daylight(hour: number) {
  if (hour < 5 || hour > 19.5) return 0;
  if (hour < 7) return (hour - 5) / 2;
  if (hour > 17.5) return (19.5 - hour) / 2;
  return 1;
}

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Phan", "Đinh", "Lý"];
const TEN_NAM = ["Hùng", "Dũng", "Minh", "Nam", "Long", "Quân", "Sơn", "Tuấn", "Thắng", "Hải", "Phong", "Khánh", "Bình", "Đức", "Việt", "Toàn"];
const TEN_NU = ["Lan", "Hoa", "Mai", "Hương", "Linh", "Trang", "Thảo", "Ngọc", "Hà", "Vân", "Yến", "Nga", "Phương", "Hạnh", "Thu", "Giang"];
const TOURISTS = ["Emma", "Lukas", "Sophie", "Kenji", "Min-ji", "Lucas", "Chloé", "Daniel", "Olivia", "Mateo", "Hannah", "Arjun", "Yuki", "Noah", "Léa", "Tom"];

export function personName(r: Rng, tourist: boolean): { name: string; female: boolean; age: number } {
  const female = r.chance(0.5);
  if (tourist) return { name: r.pick(TOURISTS), female, age: r.int(20, 65) };
  const age = r.int(8, 82);
  const given = r.pick(female ? TEN_NU : TEN_NAM);
  const title = age < 16 ? "Bé" : age < 30 ? (female ? "Chị" : "Anh") : age < 55 ? (female ? "Cô" : "Chú") : female ? "Bà" : "Ông";
  return { name: `${title} ${given}`, female, age };
}
export const surname = (r: Rng) => r.pick(HO);

/** UI + errand strings. Kept tiny on purpose; the LLM writes everything else. */
export const T = {
  vi: {
    errand: {
      home: "đang ở nhà",
      exercise: "tập thể dục quanh hồ",
      breakfast: "đi ăn sáng",
      coffee: "ngồi cà phê",
      market: "đi chợ",
      shop: "đi mua đồ",
      lunch: "đi ăn trưa",
      dinner: "đi ăn tối",
      stroll: "đi dạo phố",
      lake: "dạo quanh Hồ Gươm",
      sight: "đi thăm thú",
      temple: "đi lễ",
      bar: "ngồi bia hơi",
      nightmarket: "đi chợ đêm",
      school: "đi học",
      work: "đi làm",
      vend: "gánh hàng rong",
      ride: "chạy xe",
      watch: "đứng xem",
      flee: "tránh xa",
      shelter: "trú mưa",
      cheer: "đi bão",
      return: "về khách sạn",
      wander: "lang thang",
    },
    tourist: "Du khách",
    local: "Người dân",
    vendor: "Người bán hàng rong",
    student: "Học sinh",
    rider: "Người chạy xe",
  },
  en: {
    errand: {
      home: "at home",
      exercise: "exercising around the lake",
      breakfast: "getting breakfast",
      coffee: "having coffee",
      market: "at the market",
      shop: "shopping",
      lunch: "getting lunch",
      dinner: "getting dinner",
      stroll: "strolling",
      lake: "walking around Hoàn Kiếm Lake",
      sight: "sightseeing",
      temple: "visiting a temple",
      bar: "drinking bia hơi",
      nightmarket: "at the night market",
      school: "going to school",
      work: "going to work",
      vend: "street vending",
      ride: "riding",
      watch: "watching",
      flee: "getting away",
      shelter: "sheltering from rain",
      cheer: "celebrating",
      return: "heading back to the hotel",
      wander: "wandering",
    },
    tourist: "Tourist",
    local: "Local",
    vendor: "Street vendor",
    student: "Student",
    rider: "Rider",
  },
} as const;
export type ErrandKey = keyof (typeof T)["vi"]["errand"];
