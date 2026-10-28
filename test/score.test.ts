import { describe, it, expect } from "vitest";
import { gapScore, scarcityFromCount, tasteOverlap, usRarityFromCounts } from "../lib/score";

describe("gapScore", () => {
  it("is 100 when every factor is maxed", () => {
    expect(gapScore({ abroad: 1, momentum: 1, usRarity: 1, scarcity: 1, fit: 1 })).toBe(100);
  });
  it("punishes local saturation", () => {
    const open = gapScore({ abroad: 0.9, momentum: 0.8, usRarity: 0.9, scarcity: 0.9, fit: 0.7 });
    const saturated = gapScore({ abroad: 0.9, momentum: 0.8, usRarity: 0.02, scarcity: 0.02, fit: 0.7 });
    expect(open).toBeGreaterThan(saturated + 30);
  });
  it("is monotonic in abroad affinity", () => {
    const base = { momentum: 0.6, usRarity: 0.6, scarcity: 0.6, fit: 0.6 };
    expect(gapScore({ ...base, abroad: 0.9 })).toBeGreaterThan(gapScore({ ...base, abroad: 0.4 }));
  });
  it("handles NaN / out-of-range safely", () => {
    const s = gapScore({ abroad: NaN, momentum: 2, usRarity: -1, scarcity: -1, fit: 0.5 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
describe("helpers", () => {
  it("scarcity", () => {
    expect(scarcityFromCount(0)).toBe(1);
    expect(scarcityFromCount(50)).toBe(0);
    expect(scarcityFromCount(80)).toBe(0);
  });
  it("overlap", () => {
    expect(tasteOverlap(["a", "b"], ["a", "b"])).toBe(1);
    expect(tasteOverlap(["a", "b"], ["c"])).toBeCloseTo(0.3);
  });
});

describe("usRarityFromCounts", () => {
  it("absent in every US city = 1, saturated = 0", () => {
    expect(usRarityFromCounts([0, 0, 0, 0])).toBe(1);
    expect(usRarityFromCounts([50, 50, 50, 50])).toBe(0);
  });
  it("ranks a dish found in 3 US cities below one found nowhere (live counts Oct 28 2026)", () => {
    const croissant = usRarityFromCounts([50, 35, 11, 15]);
    const bolillos = usRarityFromCounts([0, 29, 15, 18]);
    const curryBread = usRarityFromCounts([0, 0, 0, 0]);
    expect(curryBread).toBeGreaterThan(bolillos);
    expect(bolillos).toBeGreaterThan(croissant);
  });
  it("rarity dominates: same other factors, common-in-US dish scores lower", () => {
    const base = { abroad: 0.8, momentum: 0.5, scarcity: 1, fit: 0.35 };
    expect(gapScore({ ...base, usRarity: 1 })).toBeGreaterThan(gapScore({ ...base, usRarity: 0.2 }) + 20);
  });
});
