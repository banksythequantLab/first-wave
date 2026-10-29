import { describe, it, expect } from "vitest";
import { toPins, growthClass, pickCuisineTag, parseDemographics } from "../lib/overlays";
const ent = (name: string, address: string, g?: number, loc = true) => ({ entity_id: name, name, properties: { address }, ...(loc ? { location: { lat: 40.7, lon: -74 } } : {}), query: { affinity: 0.9, ...(g === undefined ? {} : { measurements: { audience_growth: g } }) }, tags: [{ id: "urn:tag:specialty_dish:place:croissant", name: "Croissant" }, { id: "urn:tag:genre:place:restaurant:bakery", name: "Bakery" }] });
describe("overlays", () => {
  it("classifies growth", () => { expect([growthClass(1.2), growthClass(0), growthClass(-0.4), growthClass(undefined)]).toEqual(["rising", "flat", "falling", "unknown"]); });
  it("dedupes by name+address, drops no-location, caps, keeps dish tags only", () => {
    const p = toPins([ent("A", "1 Main"), ent(" a ", "1 Main"), ent("A", "2 Main"), ent("B", "x", 0.5, false), ent("C", "3", 1)], 2);
    expect(p.map((x) => x.address)).toEqual(["1 Main", "2 Main"]);
    expect(p[0].dishes).toEqual(["Croissant"]);
  });
  it("picks genre cuisine tag (category tags give empty heatmaps)", () => {
    expect(pickCuisineTag([{ id: "urn:tag:category:place:japanese_restaurant" }, { id: "urn:tag:genre:place:restaurant:japanese" }], "japanese")?.id).toBe("urn:tag:genre:place:restaurant:japanese");
  });
  it("parses demographics or returns null", () => {
    expect(parseDemographics({ results: { demographics: [] } }, "x")).toBeNull();
    expect(parseDemographics({ results: { demographics: [{ entity_id: "t", query: { age: { "25_to_29": -0.7 }, gender: { female: 0.7 } } }] } }, "x")?.gender.female).toBe(0.7);
  });
});
