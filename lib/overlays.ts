/** Pure helpers for map overlays (no network; unit-tested). */
import type { QEntity, Pin, Demographics } from "./types";
import { dedupeByName } from "./score";

/** Qloo audience_growth: 0 = flat (verified live values ~0..1.73). */
export function growthClass(g: number | undefined): Pin["trend"] {
  if (typeof g !== "number") return "unknown";
  if (g > 0.05) return "rising";
  if (g < -0.05) return "falling";
  return "flat";
}

const DISH = /^urn:tag:(specialty_dish:place|menu_highlight:qloo):/;

/** Entities → map pins: needs lat/lon, deduped by name+address, capped. */
export function toPins(ents: QEntity[], cap = 25): Pin[] {
  const keyed = ents
    .filter((e) => typeof e.location?.lat === "number" && typeof e.location?.lon === "number")
    .map((e) => ({ e, name: `${e.name} ${e.properties?.address ?? ""}` }));
  return dedupeByName(keyed).slice(0, cap).map(({ e }) => ({
    id: e.entity_id, name: e.name, address: e.properties?.address,
    lat: e.location!.lat, lng: e.location!.lon,
    affinity: e.query?.affinity, popularity: e.popularity ?? undefined, growth: e.query?.measurements?.audience_growth,
    trend: growthClass(e.query?.measurements?.audience_growth),
    dishes: [...new Set((e.tags ?? []).filter((t) => DISH.test(t.id)).map((t) => t.name))].slice(0, 8),
  }));
}

/** Origin country → cuisine search term for /v2/tags (genre tag used for the heatmap). */
export const CUISINE_BY_COUNTRY: Record<string, string> = {
  JP: "japanese", MX: "mexican", FR: "french", GB: "british", KR: "korean", NG: "nigerian", IT: "italian", TR: "turkish",
};

/** Pick the urn:tag:genre:place:restaurant:<x> tag (verified: category: tags give empty heatmaps). */
export function pickCuisineTag<T extends { id: string }>(tags: T[], term: string): T | undefined {
  return tags.find((t) => t.id === `urn:tag:genre:place:restaurant:${term}`) ?? tags.find((t) => t.id.startsWith("urn:tag:genre:place:restaurant:"));
}

type DemoResp = { results?: { demographics?: { entity_id: string; query?: { age?: Record<string, number>; gender?: Record<string, number> } }[] } };
/** Parse /v2/insights filter.type=urn:demographics. Values are relative skew (-1..1) vs. average. */
export function parseDemographics(j: DemoResp, label: string): Demographics | null {
  const d = j.results?.demographics?.[0]?.query;
  if (!d?.age && !d?.gender) return null;
  return { label, age: d.age ?? {}, gender: d.gender ?? {} };
}
