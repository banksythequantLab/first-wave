import { describe, it, expect } from "vitest";
import { dedupeByName } from "../lib/score";
describe("dedupeByName", () => {
  it("merges names differing only by case/whitespace", () => {
    const r = dedupeByName([{ name: "Sucre i Cacao" }, { name: " sucre  I cacao" }, { name: "Other" }]);
    expect(r.map((x) => x.name)).toEqual(["Sucre i Cacao", "Other"]);
  });
});
