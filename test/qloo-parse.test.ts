import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { momentumFromEntities, isDishTag, pickTypeTag } from "../lib/qloo";
import { imageFor } from "../lib/images";

// Shapes copied from live hackathon responses (values only, no names).
const ent = (g?: number) => ({ entity_id: "x", name: "x", query: { affinity: 0.98, measurements: g === undefined ? undefined : { audience_growth: g } } });

describe("live Qloo parsing", () => {
  it("momentum from audience_growth", () => {
    expect(momentumFromEntities([ent()])).toBeNull();
    expect(momentumFromEntities([ent(0)])).toBeCloseTo(0.3);
    expect(momentumFromEntities([ent(1.7320508075688774)])).toBeGreaterThan(0.98);
  });
  it("dish tags", () => {
    expect(isDishTag({ id: "urn:tag:specialty_dish:place:curry_bread", name: "Curry bread" })).toBe(true);
    expect(isDishTag({ id: "urn:tag:amenity:place:wifi", name: "Wifi" })).toBe(false);
  });
  it("prefers genre bakery tag", () => {
    expect(pickTypeTag([{ id: "urn:tag:category:place:bakery", name: "Bakery" }, { id: "urn:tag:genre:place:restaurant:bakery", name: "Bakery" }])?.id).toBe("urn:tag:genre:place:restaurant:bakery");
  });
  it("images by name, none for unknown", () => {
    expect(imageFor("urn:tag:specialty_dish:place:salt_bread", "Salt bread", {})?.image).toBe("/trends/salt-bread.webp");
    expect(imageFor("urn:tag:specialty_dish:place:curry_bread", "Curry bread", {})).toBeUndefined();
  });
});
