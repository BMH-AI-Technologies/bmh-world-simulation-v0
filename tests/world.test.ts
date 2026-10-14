import { describe, expect, it } from "vitest";
import { findPath } from "../src/sim/path";
import { testWorld } from "./helpers";

describe("world", () => {
  const w = testWorld();
  it("has the Old Quarter landmarks", () => {
    const names = w.landmarks.map((l) => l.name);
    for (const n of ["Hồ Gươm", "Tháp Rùa", "Chợ Đồng Xuân", "Ô Quan Chưởng", "Phố đường tàu"]) expect(names).toContain(n);
    expect(w.lakeNodes.length).toBeGreaterThan(20);
  });
  it("resolves places with or without diacritics", () => {
    expect(w.resolvePlace("Hàng Bạc")?.street).toBe("Phố Hàng Bạc");
    expect(w.resolvePlace("hang bac")?.street).toBe("Phố Hàng Bạc");
    expect(w.resolvePlace("hồ gươm")?.name).toBe("Hồ Gươm");
    expect(w.resolvePlace("Chợ Đồng Xuân")?.name).toBe("Chợ Đồng Xuân");
  });
  it("routes walkers between any two landmarks", () => {
    for (const a of w.landmarks) for (const b of w.landmarks) expect(findPath(w, a.node, b.node, false)).not.toBeNull();
  });
  it("routes bikes across the drivable network", () => {
    const a = w.nearestNode(-400, -400, true), b = w.nearestNode(400, 500, true);
    const p = findPath(w, a, b, true);
    expect(p).not.toBeNull();
    for (let i = 1; i < p!.length; i++) expect(w.adj[p![i - 1]].some((e) => e.to === p![i] && e.drive)).toBe(true);
  });
});
