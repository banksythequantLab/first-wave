import type { ScoreParts } from "./types";

/**
 * Weights for the gap score (weighted geometric mean). Sum to 1.
 * US rarity carries the most weight so dishes already everywhere in the US
 * (croissant, baguette) drop and genuinely new-to-US dishes rise.
 */
export const WEIGHTS: ScoreParts = { abroad: 0.25, momentum: 0.15, usRarity: 0.3, scarcity: 0.15, fit: 0.15 };

const clamp = (x: number) => Math.min(1, Math.max(0.01, Number.isFinite(x) ? x : 0.01));

/**
 * Gap score 0-100: abroad affinity x momentum x local scarcity x local fit.
 * Weighted geometric mean, so any near-zero factor pulls the score down hard
 * (a trend that's already saturated locally can't score high).
 */
export function gapScore(p: ScoreParts, w: ScoreParts = WEIGHTS): number {
  const s =
    Math.pow(clamp(p.abroad), w.abroad) *
    Math.pow(clamp(p.momentum), w.momentum) *
    Math.pow(clamp(p.usRarity), w.usRarity) *
    Math.pow(clamp(p.scarcity), w.scarcity) *
    Math.pow(clamp(p.fit), w.fit);
  return Math.round(s * 100);
}

/** Local scarcity from how many local places Qloo returns for the tag (0 = whitespace). */
export function scarcityFromCount(count: number, cap = 50): number {
  return 1 - Math.min(count, cap) / cap;
}

/** Overlap between candidate's co-tags and the local taste profile (0..1). */
export function tasteOverlap(candidate: string[], local: string[]): number {
  if (!candidate.length || !local.length) return 0.3;
  const L = new Set(local);
  const hits = candidate.filter((t) => L.has(t)).length;
  return 0.3 + 0.7 * (hits / candidate.length);
}

/** US benchmark cities for the rarity signal ("New York City", not "New York": that resolves to NY State). */
export const US_CITIES = ["New York City", "Los Angeles", "Chicago", "Houston"];

/**
 * US rarity 0..1 from how many places carry the dish tag across US_CITIES.
 * Each city is capped at its query size (take=50), so 0 everywhere = 1.0, 50 in each = 0.
 * Square-root curve: the first few US places already cut rarity noticeably.
 */
export function usRarityFromCounts(counts: number[], perCityCap = 50): number {
  if (!counts.length) return 0.5;
  const share = counts.reduce((s, c) => s + Math.min(c, perCityCap), 0) / (perCityCap * counts.length);
  return 1 - Math.sqrt(share);
}

/** Merge venues whose names differ only by case/whitespace (seen live: "Sucre i Cacao" / "Sucre I Cacao"). Keeps the first (highest affinity). */
export function dedupeByName<T extends { name: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => { const k = x.name.toLowerCase().replace(/\s+/g, " ").trim(); if (seen.has(k)) return false; seen.add(k); return true; });
}

