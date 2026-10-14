import { describe, expect, it } from "vitest";
import { mockDirect } from "../src/sim/events";
import { testWorld } from "./helpers";

describe("mock director", () => {
  const w = testWorld();
  const cases: [string, string, string | null][] = [
    ["Cháy lớn ở Hàng Bạc", "fire", "Phố Hàng Bạc"],
    ["chay nha o hang bac", "fire", "Phố Hàng Bạc"],
    ["Múa lân ở Hồ Gươm", "lion_dance", "Hồ Gươm"],
    ["Mưa to bất chợt", "rain", null],
    ["Mưa rào bất chợt", "rain", null],
    ["Rào chắn cấm đường Hàng Đào", "roadblock", "Phố Hàng Đào"],
    ["Việt Nam vô địch, cả phố đi bão", "celebration", null],
    ["Mất điện toàn khu", "outage", null],
    ["Một con trâu xổng chuồng ở Chợ Đồng Xuân", "animal", "Chợ Đồng Xuân"],
    ["Tàu hỏa chạy qua phố đường tàu", "train", "Phố đường tàu"],
    ["Giông bão kéo đến", "storm", null],
    ["Tắc đường ở Hàng Đào", "jam", "Phố Hàng Đào"],
    ["Đoàn quay phim MV ở Nhà thờ Lớn", "filming", "Nhà thờ Lớn"],
    ["A flash mob near the cathedral", "crowd", null],
  ];
  for (const [text, kind, place] of cases) {
    it(text, () => {
      const out = mockDirect(w, text, "vi");
      expect(out.kind).toBe(kind);
      if (place) expect(out.place).toBe(place);
    });
  }
});
