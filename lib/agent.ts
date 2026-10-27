import "server-only";
import type { Business, ScoutEvent, TrendCard, Evidence, QEntity } from "./types";
import * as qloo from "./qloo";
import { gapScore, scarcityFromCount, tasteOverlap } from "./score";
import { writeKit } from "./llm";
import { TREND_IMAGES } from "./fixtures";

export const SOURCE_CITIES: { city: string; country: string }[] = [
  { city: "Seoul", country: "KR" }, { city: "Mexico City", country: "MX" },
  { city: "Lagos", country: "NG" }, { city: "Tokyo", country: "JP" },
];

const aff = (e: QEntity) => e.query?.affinity ?? e.popularity ?? 0.5;

export async function runScout(b: Business, emit: (e: ScoutEvent) => void): Promise<void> {
  const t0 = Date.now();
  const log = (msg: string) => emit({ type: "log", msg, t: Date.now() - t0 });
  const mock = qloo.isMock();
  if (mock) log("⚠️ MOCK MODE — using fake fixture data (no QLOO_API_KEY).");

  log(`Resolving "${b.type}" to a Qloo tag via /v2/tags…`);
  const typeTag = (await qloo.searchTags(b.type, 3))[0];
  if (!typeTag) throw new Error(`No Qloo tag found for "${b.type}"`);
  log(`→ ${typeTag.name} (${typeTag.id})`);

  log(`Building local taste profile for ${b.location} (/v2/insights, filter.location.query)…`);
  const local = await qloo.insights({ filterType: "urn:entity:place", locationQuery: b.location, tags: [typeTag.id], take: 30 });
  const freq = new Map<string, number>();
  for (const e of local) for (const t of e.tags ?? []) freq.set(t.id, (freq.get(t.id) ?? 0) + 1);
  const profile = [...freq.entries()].sort((a, z) => z[1] - a[1]).slice(0, 12).map(([id]) => id);
  const tagName = new Map<string, string>();
  for (const e of local) for (const t of e.tags ?? []) tagName.set(t.id, t.name);
  log(`→ ${local.length} local places; top tastes: ${profile.slice(0, 5).map((id) => tagName.get(id)).join(", ")}`);

  type Cand = { tagId: string; name: string; city: string; country: string; ev: QEntity[]; coTags: string[] };
  const cands: Cand[] = [];
  for (const sc of SOURCE_CITIES) {
    log(`Scouting ${sc.city} (bias.trends=high)…`);
    let ents: QEntity[] = [];
    try { ents = await qloo.insights({ filterType: "urn:entity:place", locationQuery: sc.city, tags: [typeTag.id], biasTrends: "high", take: 30 }); }
    catch (err) { log(`  ${sc.city}: ${(err as Error).message}`); }
    if (!ents.length) { log(`  ${sc.city}: no data returned, skipping`); continue; }
    const byTag = new Map<string, Cand>();
    for (const e of ents) for (const t of e.tags ?? []) {
      if (t.id === typeTag.id || profile.includes(t.id)) continue; // only things NOT already part of local taste
      const c = byTag.get(t.id) ?? { tagId: t.id, name: t.name, city: sc.city, country: sc.country, ev: [], coTags: [] };
      c.ev.push(e); for (const o of e.tags ?? []) if (o.id !== t.id && o.id !== typeTag.id) c.coTags.push(o.id);
      byTag.set(t.id, c);
    }
    const top = [...byTag.values()].sort((a, z) => z.ev.reduce((s, e) => s + aff(e), 0) - a.ev.reduce((s, e) => s + aff(e), 0)).slice(0, 3);
    log(`  → ${ents.length} places; rising signals: ${top.map((c) => c.name).join(", ") || "none"}`);
    cands.push(...top);
  }

  log(`Scoring ${cands.length} candidates: momentum (/v2/trending), local scarcity, local fit…`);
  const cards: TrendCard[] = [];
  for (const c of cands) {
    const ev = c.ev.sort((a, z) => aff(z) - aff(a)).slice(0, 3);
    const abroad = ev.slice(0, 2).reduce((s, e) => s + aff(e), 0) / Math.min(2, ev.length);
    const m = await qloo.momentum(ev.map((e) => e.entity_id), c.tagId);
    const count = await qloo.localCount(b.location, c.tagId);
    const fit = tasteOverlap([...new Set(c.coTags)], profile);
    const parts = { abroad, momentum: m ?? 0.5, scarcity: scarcityFromCount(count), fit };
    const shared = [...new Set(c.coTags)].filter((t) => profile.includes(t)).map((t) => tagName.get(t) ?? t);
    cards.push({
      id: `${c.city}-${c.tagId}`.replace(/[^a-z0-9]+/gi, "-"), trend: c.name, tagId: c.tagId,
      originCity: c.city, originCountry: c.country, fitScore: gapScore(parts), parts, momentumAvailable: m !== null,
      evidence: ev.map<Evidence>((e) => ({ name: e.name, city: c.city, affinity: aff(e), entity_id: e.entity_id })),
      localCount: count,
      ...(TREND_IMAGES[c.tagId] ? { image: TREND_IMAGES[c.tagId].src, imageAlt: TREND_IMAGES[c.tagId].alt } : {}),
      whyItFits: [
        `${ev.length} high-affinity ${c.city} spots feature it (top affinity ${aff(ev[0]).toFixed(2)})`,
        count === 0 ? `Zero ${b.location} places tagged with it — open whitespace` : `Only ${count} ${b.location} places carry it`,
        shared.length ? `Shares local tastes: ${shared.slice(0, 3).join(", ")}` : "New flavor for the neighborhood",
        m === null ? "Momentum: not available from /v2/trending" : `Momentum index ${(m * 100).toFixed(0)}/100`,
      ],
      heatmap: [],
    });
  }
  // one card per origin city for variety, then top 3
  const best = new Map<string, TrendCard>();
  for (const k of cards.sort((a, z) => z.fitScore - a.fitScore)) if (!best.has(k.originCity)) best.set(k.originCity, k);
  const top3 = [...best.values()].slice(0, 3);
  log(`Top 3: ${top3.map((k) => `${k.trend} (${k.originCity}) ${k.fitScore}`).join(" · ")}`);

  for (const k of top3) {
    log(`Mapping where ${k.trend} fans cluster in ${b.location} (urn:heatmap)…`);
    try { k.heatmap = await qloo.heatmap(b.location, k.tagId); } catch { k.heatmap = []; }
    log(`Writing launch kit for ${k.trend}…`);
    k.kit = await writeKit(b, k);
  }
  log("Done ✔");
  emit({ type: "result", cards: top3, mock, profile: profile.map((id) => tagName.get(id) ?? id), business: b });
}
