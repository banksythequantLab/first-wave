/**
 * Single server-side Qloo client. All Qloo HTTP calls go through here.
 * Endpoints/params follow https://docs.qloo.com (hackathon guide:
 * https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide).
 * MOCK mode (QLOO_MOCK=1, or no QLOO_API_KEY) serves lib/fixtures.ts (fake).
 */
import "server-only";
import type { QEntity, Tag, HeatPoint } from "./types";
import { MOCK_ABROAD, MOCK_LOCAL, MOCK_LOCAL_COUNTS, MOCK_TAGS, mockHeatmap } from "./fixtures";

const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY || "";
export const isMock = () => process.env.QLOO_MOCK === "1" || !KEY;

const cache = new Map<string, unknown>(); // private, in-memory only (allowed by Qloo guide)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Small concurrency limiter so parallel scoring doesn't trip the rate limit. */
const MAX_CONCURRENT = Number(process.env.QLOO_CONCURRENCY || 3);
let active = 0; const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

async function get<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${BASE}${path}?${qs}`;
  if (cache.has(url)) return cache.get(url) as T;
  const r = await limited(async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { "X-Api-Key": KEY, accept: "application/json" }, cache: "no-store" });
      if (res.status !== 429 || attempt >= 4) return res;
      await sleep(800 * 2 ** attempt); // hackathon host returns 429 "Rate limit exceeded" on bursts
    }
  });
  if (!r.ok) throw new Error(`Qloo ${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as T;
  cache.set(url, j);
  return j;
}

/** Prefer the genre tag (works with urn:heatmap); verified live: category tag returns empty heatmaps. */
export function pickTypeTag(tags: Tag[]): Tag | undefined {
  return tags.find((t) => t.id.startsWith("urn:tag:genre:place")) ?? tags[0];
}

type InsightsResp = { results?: { entities?: QEntity[]; tags?: Tag[]; heatmap?: { location: { latitude: number; longitude: number }; query: { affinity: number } }[] } };

export type InsightsParams = {
  filterType: string; locationQuery?: string; signalLocationQuery?: string; countryCode?: string;
  tags?: string[]; signalTags?: string[]; entities?: string[]; biasTrends?: "low" | "medium" | "high";
  explain?: boolean; take?: number;
};

/** GET /v2/insights */
export async function insights(p: InsightsParams): Promise<QEntity[]> {
  if (isMock()) return mockInsights(p);
  const j = await get<InsightsResp>("/v2/insights", {
    "filter.type": p.filterType,
    "filter.location.query": p.locationQuery,
    "signal.location.query": p.signalLocationQuery,
    "filter.geocode.country_code": p.countryCode,
    "filter.tags": p.tags?.join(","),
    "signal.interests.tags": p.signalTags?.join(","),
    "signal.interests.entities": p.entities?.join(","),
    "bias.trends": p.biasTrends,
    "feature.explainability": p.explain || undefined,
    take: p.take ?? 20,
  });
  return j.results?.entities ?? [];
}

/** GET /v2/tags?filter.query= */
export async function searchTags(query: string, take = 5): Promise<Tag[]> {
  if (isMock()) {
    const q = query.toLowerCase();
    return Object.values(MOCK_TAGS).filter((t) => t.name.toLowerCase().includes(q) || q.includes(t.name.toLowerCase())).slice(0, take);
  }
  const j = await get<{ results?: { tags?: Tag[] } }>("/v2/tags", { "filter.query": query, "feature.typo_tolerance": true, take });
  return j.results?.tags ?? [];
}

/**
 * Momentum. Verified Oct 28 2026: /v2/trending on the hackathon host rejects
 * filter.type=urn:entity:place (allowed: actor, artist, brand, movie, person,
 * podcast, tv_show). So for places we use what /v2/insights returns with
 * bias.trends: query.measurements.audience_growth (0 = flat, ~1.73 max seen).
 * Returns 0..1, or null when no evidence carries the measurement.
 */
export function momentumFromEntities(ents: QEntity[]): number | null {
  const g = ents.map((e) => e.query?.measurements?.audience_growth).filter((x): x is number => typeof x === "number");
  if (!g.length) return null;
  const avg = g.reduce((s, x) => s + x, 0) / g.length;
  return Math.min(1, 0.3 + 0.7 * (avg / 1.75));
}

/** Tag types that name an actual dish/product (verified in live responses). */
export const isDishTag = (t: Tag) => /^urn:tag:(specialty_dish:place|menu_highlight:qloo):/.test(t.id);

/** Count of local places with a tag (for scarcity): /v2/insights filter.location.query + filter.tags */
export async function localCount(location: string, tagId: string): Promise<number> {
  if (isMock()) return MOCK_LOCAL_COUNTS[tagId] ?? 10;
  const ents = await insights({ filterType: "urn:entity:place", locationQuery: location, tags: [tagId], take: 50 });
  // filter.tags is a hard filter, but count only entities that really carry the tag
  return ents.filter((e) => e.tags?.some((t) => t.id === tagId)).length;
}

/** Heatmap: /v2/insights filter.type=urn:heatmap (docs: reference/heatmaps-use-case) */
export async function heatmap(location: string, tagId: string): Promise<HeatPoint[]> {
  if (isMock()) return mockHeatmap(tagId);
  const j = await get<InsightsResp>("/v2/insights", {
    "filter.type": "urn:heatmap", "filter.location.query": location, "signal.interests.tags": tagId,
  });
  return (j.results?.heatmap ?? []).slice(0, 400).map((h) => ({ lat: h.location.latitude, lng: h.location.longitude, affinity: h.query.affinity }));
}

function mockInsights(p: InsightsParams): QEntity[] {
  const city = p.locationQuery || p.signalLocationQuery || "";
  const list = MOCK_ABROAD[city] ?? MOCK_LOCAL;
  const want = p.tags?.[0];
  return list.filter((x) => !want || x.tags?.some((t) => t.id === want) || want.includes("cafe") || want.includes("bakery")).slice(0, p.take ?? 20);
}
