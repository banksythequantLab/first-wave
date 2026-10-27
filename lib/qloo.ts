/**
 * Single server-side Qloo client. All Qloo HTTP calls go through here.
 * Endpoints/params follow https://docs.qloo.com (hackathon guide:
 * https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide).
 * MOCK mode (QLOO_MOCK=1, or no QLOO_API_KEY) serves lib/fixtures.ts (fake).
 */
import "server-only";
import type { QEntity, Tag, HeatPoint } from "./types";
import { MOCK_ABROAD, MOCK_LOCAL, MOCK_LOCAL_COUNTS, MOCK_MOMENTUM, MOCK_TAGS, mockHeatmap } from "./fixtures";

const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY || "";
export const isMock = () => process.env.QLOO_MOCK === "1" || !KEY;

const cache = new Map<string, unknown>(); // private, in-memory only (allowed by Qloo guide)

async function get<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${BASE}${path}?${qs}`;
  if (cache.has(url)) return cache.get(url) as T;
  const r = await fetch(url, { headers: { "X-Api-Key": KEY, accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error(`Qloo ${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as T;
  cache.set(url, j);
  return j;
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
 * GET /v2/trending (week-over-week). Requires signal.interests.entities, filter.type,
 * filter.start_date, filter.end_date (docs: reference/get-trending).
 * Response shape is UNVERIFIED on the hackathon host; we normalize defensively
 * and return null if unavailable so the agent can mark momentum "n/a".
 */
export async function momentum(entityIds: string[], tagId: string, filterType = "urn:entity:place"): Promise<number | null> {
  if (isMock()) return MOCK_MOMENTUM[tagId] ?? 0.5;
  const end = new Date(), start = new Date(end.getTime() - 28 * 864e5);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  try {
    const j = await get<Record<string, unknown>>("/v2/trending", {
      "signal.interests.entities": entityIds.join(","), "filter.type": filterType,
      "filter.start_date": d(start), "filter.end_date": d(end),
    });
    const nums: number[] = [];
    JSON.stringify(j, (k, v) => { if (/(change|growth|delta|trend)/i.test(k) && typeof v === "number") nums.push(v); return v; });
    if (!nums.length) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return 1 / (1 + Math.exp(-avg * 3)); // squash to 0..1
  } catch { return null; }
}

/** Count of local places with a tag (for scarcity): /v2/insights filter.location.query + filter.tags */
export async function localCount(location: string, tagId: string): Promise<number> {
  if (isMock()) return MOCK_LOCAL_COUNTS[tagId] ?? 10;
  const ents = await insights({ filterType: "urn:entity:place", locationQuery: location, tags: [tagId], take: 50 });
  return ents.length;
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
