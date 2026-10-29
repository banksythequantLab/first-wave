import { dedupeByName } from "./score";
import "server-only";
import type { Business, ScoutEvent, TrendCard, Evidence, QEntity } from "./types";
import * as qloo from "./qloo";
import { gapScore, scarcityFromCount, tasteOverlap, usRarityFromCounts, US_CITIES } from "./score";
import { writeKit } from "./llm";
import { TREND_IMAGES, MOCK_MOMENTUM } from "./fixtures";
import { imageFor } from "./images";
import { toPins, CUISINE_BY_COUNTRY, pickCuisineTag } from "./overlays";
import type { Overlays, HeatLayer, Tag } from "./types";

type City = { city: string; country: string };
/** Mock fixtures are keyed to these cities. */
export const MOCK_SOURCE_CITIES: City[] = [
  { city: "Seoul", country: "KR" }, { city: "Mexico City", country: "MX" },
  { city: "Lagos", country: "NG" }, { city: "Tokyo", country: "JP" },
];
/**
 * Live cities, chosen from a coverage check on the hackathon host (Oct 28 2026, bakery):
 * Tokyo and Mexico City return many specialty-dish tags; Paris and London some.
 * Seoul returned 0 dish tags, Lagos and Istanbul only generic "cake" tags, so they were dropped.
 */
export const LIVE_SOURCE_CITIES: City[] = [
  { city: "Tokyo", country: "JP" }, { city: "Mexico City", country: "MX" },
  { city: "Paris", country: "FR" }, { city: "London", country: "GB" },
];
/** Too generic to be a "trend". */
const GENERIC = /^(cakes?|pastr(y|ies)|sandwich(es)?|coffee|breads?|desserts?|nice cake|birthday cake|food|tea|.*baked goods|bakery goods|layer cakes?)$/i;
/** Supermarkets etc. carry the bakery tag in Qloo but are not bakeries (seen live: Sainsbury's, ShopRite). */
const NOT_A_SHOP = /:(supermarket|grocery_store|wholesale_grocer|produce_market|hypermarket|department_store|convenience_store|clothing_store|office_supply_store)$/;
const isRealShop = (e: QEntity) => !(e.tags ?? []).some((t) => NOT_A_SHOP.test(t.id));

const aff = (e: QEntity) => e.query?.affinity ?? e.popularity ?? 0.5;

export async function runScout(b: Business, emit: (e: ScoutEvent) => void): Promise<void> {
  const t0 = Date.now();
  const log = (msg: string) => emit({ type: "log", msg, t: Date.now() - t0 });
  const mock = qloo.isMock();
  if (mock) log("⚠️ MOCK MODE — using fake fixture data (no QLOO_API_KEY).");

  log(`Resolving "${b.type}" to a Qloo tag via /v2/tags…`);
  const typeTag = qloo.pickTypeTag(await qloo.searchTags(b.type, 5));
  if (!typeTag) throw new Error(`No Qloo tag found for "${b.type}"`);
  log(`→ ${typeTag.name} (${typeTag.id})`);

  log(`Building local taste profile for ${b.location} (/v2/insights, filter.location.query)…`);
  let local = await qloo.insights({ filterType: "urn:entity:place", locationQuery: b.location, tags: [typeTag.id], take: 30 });
  if (!mock) local = local.filter(isRealShop);
  const freq = new Map<string, number>();
  for (const e of local) for (const t of e.tags ?? []) freq.set(t.id, (freq.get(t.id) ?? 0) + 1);
  const profile = [...freq.entries()].sort((a, z) => z[1] - a[1]).slice(0, 12).map(([id]) => id);
  const tagName = new Map<string, string>();
  for (const e of local) for (const t of e.tags ?? []) tagName.set(t.id, t.name);
  log(`→ ${local.length} local places; top tastes: ${profile.slice(0, 5).map((id) => tagName.get(id)).join(", ")}`);

  const localNames = new Set([...tagName.values()].map((n) => n.toLowerCase()));
  type Cand = { tagId: string; name: string; city: string; country: string; ev: QEntity[]; coTags: string[] };
  const cands: Cand[] = [];
  for (const sc of mock ? MOCK_SOURCE_CITIES : LIVE_SOURCE_CITIES) {
    log(`Scouting ${sc.city} (bias.trends=high)…`);
    let ents: QEntity[] = [];
    try { ents = await qloo.insights({ filterType: "urn:entity:place", locationQuery: sc.city, tags: [typeTag.id], biasTrends: "high", take: 30 }); }
    catch (err) { log(`  ${sc.city}: ${(err as Error).message}`); }
    if (!mock) ents = ents.filter(isRealShop);
    if (!ents.length) { log(`  ${sc.city}: no data returned, skipping`); continue; }
    const byTag = new Map<string, Cand>();
    for (const e of ents) for (const t of e.tags ?? []) {
      if (t.id === typeTag.id || profile.includes(t.id)) continue;
      if (!mock && (!qloo.isDishTag(t) || GENERIC.test(t.name) || localNames.has(t.name.toLowerCase()))) continue; // only things NOT already part of local taste
      const c = byTag.get(t.id) ?? { tagId: t.id, name: t.name, city: sc.city, country: sc.country, ev: [], coTags: [] };
      c.ev.push(e); for (const o of e.tags ?? []) if (o.id !== t.id && o.id !== typeTag.id) c.coTags.push(o.id);
      byTag.set(t.id, c);
    }
    // live: need 2+ distinct places, so one venue can't make a "trend"
    const top = [...byTag.values()].filter((c) => mock || dedupeByName(c.ev).length >= 2).sort((a, z) => z.ev.reduce((s, e) => s + aff(e), 0) - a.ev.reduce((s, e) => s + aff(e), 0)).slice(0, 3);
    log(`  → ${ents.length} places; rising signals: ${top.map((c) => c.name).join(", ") || "none"}`);
    cands.push(...top);
  }

  log(`Scoring ${cands.length} candidates: momentum (audience growth), US rarity, local scarcity, local fit…`);
  const cards: TrendCard[] = [];
  const usCache = new Map<string, Promise<Record<string, number>>>(); // per tag, per run
  const usCounts = (tagId: string) => {
    if (!usCache.has(tagId)) usCache.set(tagId, Promise.all(US_CITIES.map((city) => qloo.localCount(city, tagId).catch(() => -1)))
      .then((n) => Object.fromEntries(US_CITIES.map((city, i) => [city, n[i]]))));
    return usCache.get(tagId)!;
  };
  /** "Traditional baguette" is still a baguette: also count the base dish tag (max of the two per city). */
  const MODIFIER = /^(urn:tag:[a-z_]+:[a-z_]+:)(traditional|classic|fresh|homemade|artisan|french|mini)_(.+)$/;
  const usCountsWithBase = async (tagId: string) => {
    const own = await usCounts(tagId);
    const m = tagId.match(MODIFIER);
    if (!m) return own;
    const base = await usCounts(m[1] + m[3]);
    return Object.fromEntries(US_CITIES.map((c) => [c, Math.max(own[c], base[c])]));
  };
  const scoreOne = async (c: Cand) => {
    const ev = dedupeByName(c.ev.sort((a, z) => aff(z) - aff(a))).slice(0, 3);
    const abroad = ev.slice(0, 2).reduce((s, e) => s + aff(e), 0) / Math.min(2, ev.length);
    const m = mock ? (MOCK_MOMENTUM[c.tagId] ?? 0.5) : qloo.momentumFromEntities(ev);
    const [count, us] = await Promise.all([qloo.localCount(b.location, c.tagId), mock ? Promise.resolve(null) : usCountsWithBase(c.tagId)]);
    const fit = tasteOverlap([...new Set(c.coTags)], profile);
    const scarcity = scarcityFromCount(count);
    const usVals = us ? Object.values(us).filter((n) => n >= 0) : [];
    const usRarity = us ? usRarityFromCounts(usVals) : scarcity; // mock: no US data, mirror local scarcity
    const usTotal = usVals.reduce((s, n) => s + n, 0);
    const parts = { abroad, momentum: m ?? 0.5, usRarity, scarcity, fit };
    if (us) log(`  ${c.name} (${c.city}): US places ${US_CITIES.map((x) => `${x.replace(" City", "")} ${us[x] < 0 ? "err" : us[x]}`).join(", ")} → rarity ${(usRarity * 100).toFixed(0)}`);
    const shared = [...new Set(c.coTags)].filter((t) => profile.includes(t)).map((t) => tagName.get(t) ?? t);
    cards.push({
      id: `${c.city}-${c.tagId}`.replace(/[^a-z0-9]+/gi, "-"), trend: c.name, tagId: c.tagId,
      originCity: c.city, originCountry: c.country, fitScore: gapScore(parts), parts, momentumAvailable: m !== null,
      evidence: ev.map<Evidence>((e) => ({ name: e.name, city: c.city, affinity: aff(e), entity_id: e.entity_id })),
      localCount: count, ...(us ? { usCounts: us } : {}),
      ...(imageFor(c.tagId, c.name, TREND_IMAGES) ?? {}),
      whyItFits: [
        `${ev.length} high-affinity ${c.city} spots feature it (top affinity ${aff(ev[0]).toFixed(2)})`,
        count === 0 ? `Zero ${b.location} places tagged with it — open whitespace` : `Only ${count} ${b.location} places carry it`,
        ...(us ? [usTotal === 0 ? `Not tagged at any place in ${US_CITIES.join(", ")} (Qloo)` : `${usTotal} places across ${US_CITIES.length} big US cities carry it`] : []),
        shared.length ? `Shares local tastes: ${shared.slice(0, 3).join(", ")}` : "New flavor for the neighborhood",
        m === null ? "Momentum: no audience-growth data from Qloo" : `Momentum index ${(m * 100).toFixed(0)}/100 (Qloo audience growth)`,
      ],
      heatmap: [],
    });
  };
  // 4 candidates at a time (each = 1 local + 4 US calls, US cached per tag)
  for (let i = 0; i < cands.length; i += 4) await Promise.all(cands.slice(i, i + 4).map(scoreOne));
  // one card per origin city for variety, then top 3
  const best = new Map<string, TrendCard>();
  for (const k of cards.sort((a, z) => z.fitScore - a.fitScore)) if (!best.has(k.originCity)) best.set(k.originCity, k);
  const top3 = [...best.values()].slice(0, 3);
  log(`Top 3: ${top3.map((k) => `${k.trend} (${k.originCity}) ${k.fitScore}`).join(" · ")}`);

  // Overlays run in parallel with heatmaps/kits and stream after the cards.
  const overlaysP = buildOverlays(b.location, typeTag, local, top3, mock, log);
  for (const k of top3) {
    log(`Mapping where ${k.trend} fans cluster in ${b.location} (urn:heatmap)…`);
    try { k.heatmap = await qloo.heatmap(b.location, k.tagId); } catch { k.heatmap = []; }
    if (!k.heatmap.length && !mock) {
      log(`  no ${k.trend} heatmap for ${b.location}; showing where ${typeTag.name} fans cluster instead`);
      try { k.heatmap = await qloo.heatmap(b.location, typeTag.id); } catch { k.heatmap = []; }
      k.heatmapLevel = "category";
    } else {
      k.heatmapLevel = "dish";
    }
    log(`Writing launch kit for ${k.trend}…`);
    k.kit = await writeKit(b, k);
  }
  emit({ type: "result", cards: top3, mock, profile: profile.map((id) => tagName.get(id) ?? id), business: b });
  const overlays = await overlaysP;
  log(`Map overlays: ${overlays.pins.length} competitor pins, heatmap layers: ${overlays.layers.map((l) => l.label).join(", ")}${overlays.demographics ? ", demographics" : ""}`);
  emit({ type: "overlays", overlays });
  log("Done ✔");
}

async function buildOverlays(location: string, typeTag: Tag, local: QEntity[], top3: TrendCard[], mock: boolean, log: (m: string) => void): Promise<Overlays> {
  // Competitor pins: the local same-category places already fetched (no extra call); mock entities get fake coordinates.
  const src = mock ? local.map((e, i) => ({ ...e, location: { lat: 40.744 + (i - 1) * 0.006, lon: -74.032 + ((i % 2) - 0.5) * 0.008 }, query: { ...e.query, measurements: { audience_growth: [0.6, 0, -0.2][i % 3] } } })) : local;
  const pins = toPins(src, 25);
  const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const layerFor = async (term: string, tag: Tag | undefined): Promise<HeatLayer | null> => {
    if (!tag) return null;
    try { const points = await qloo.heatmap(location, tag.id); return points.length ? { label: label(term), tagId: tag.id, points } : null; }
    catch (err) { log(`  heatmap ${term}: ${(err as Error).message}`); return null; }
  };
  const terms = [...new Set([...top3.map((k) => CUISINE_BY_COUNTRY[k.originCountry]).filter(Boolean), "cafe"])];
  const cuisine = terms.map(async (term) => {
    if (mock) return layerFor(term, { id: `urn:tag:mock:${term}`, name: term });
    const tags = await qloo.searchTags(term, 15).catch(() => []);
    return layerFor(term === "cafe" ? "café" : `${term} restaurant`, term === "cafe" ? tags.find((t) => t.id === "urn:tag:genre:place:restaurant:cafe") : pickCuisineTag(tags, term));
  });
  const [layers, demographics] = await Promise.all([
    Promise.all([layerFor(typeTag.name.toLowerCase(), typeTag), ...cuisine]),
    qloo.demographics(typeTag.id, `${typeTag.name} fans`).catch(() => null),
  ]);
  const ok = layers.filter((l): l is HeatLayer => !!l);
  const seen = new Set<string>();
  return { pins, layers: ok.filter((l) => !seen.has(l.tagId) && seen.add(l.tagId)), demographics };
}
