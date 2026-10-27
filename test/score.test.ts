import { describe, it, expect } from "vitest";
import { gapScore, scarcityFromCount, tasteOverlap } from "../lib/score";

describe("gapScore", () => {
  it("is 100 when every factor is maxed", () => {
    expect(gapScore({ abroad: 1, momentum: 1, scarcity: 1, fit: 1 })).toBe(100);
  });
  it("punishes local saturation", () => {
    const open = gapScore({ abroad: 0.9, momentum: 0.8, scarcity: 0.9, fit: 0.7 });
    const saturated = gapScore({ abroad: 0.9, momentum: 0.8, scarcity: 0.02, fit: 0.7 });
    expect(open).toBeGreaterThan(saturated + 30);
  });
  it("is monotonic in abroad affinity", () => {
    const base = { momentum: 0.6, scarcity: 0.6, fit: 0.6 };
    expect(gapScore({ ...base, abroad: 0.9 })).toBeGreaterThan(gapScore({ ...base, abroad: 0.4 }));
  });
  it("handles NaN / out-of-range safely", () => {
    const s = gapScore({ abroad: NaN, momentum: 2, scarcity: -1, fit: 0.5 });
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
