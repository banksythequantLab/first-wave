/**
 * ⚠️ MOCK FIXTURES — 100% FAKE DATA, hand-written for offline development.
 * Shaped like documented Qloo responses, but NOT from Qloo. Every name is
 * prefixed "[MOCK]". Never replace this file with real Qloo responses:
 * Qloo's hackathon terms forbid storing Qloo data in a public repo.
 */
import type { QEntity, Tag, HeatPoint } from "./types";

const t = (id: string, name: string): Tag => ({ id: `urn:tag:mock:${id}`, name, type: "urn:tag:mock" });
export const MOCK_TAGS: Record<string, Tag> = {
  bakery: t("bakery", "Bakery"), cafe: t("cafe", "Cafe"), bar: t("bar", "Bar"), boutique: t("boutique", "Boutique"),
  saltbread: t("salt_bread", "Salt bread"), creambun: t("cream_bun", "Cream bun"), pandulce: t("pan_dulce", "Pan dulce"),
  puffpuff: t("puff_puff", "Puff-puff"), melonpan: t("melon_pan", "Melon pan"), hojicha: t("hojicha", "Hojicha"),
  zobo: t("zobo", "Zobo (hibiscus drink)"), cafedeolla: t("cafe_de_olla", "Café de olla"), injeolmi: t("injeolmi", "Injeolmi"),
  croissant: t("croissant", "Croissant"), latte: t("latte", "Latte"), brunch: t("brunch", "Brunch"),
  sourdough: t("sourdough", "Sourdough"), matcha: t("matcha", "Matcha"), cozy: t("cozy", "Cozy"),
  instagrammable: t("instagrammable", "Instagrammable"), mezcal: t("mezcal", "Mezcal"), afrobeats: t("afrobeats", "Afrobeats"), kpop: t("kpop", "K-pop"), street: t("street_food", "Street food"), late: t("late_night", "Late night"),
};
const T = MOCK_TAGS;

let n = 0;
const e = (name: string, city: string, cc: string, aff: number, tags: Tag[]): QEntity => ({
  entity_id: `MOCK-${++n}`, name: `[MOCK] ${name}`, subtype: "urn:entity:place",
  properties: { geocode: { name: city, country_code: cc } }, tags, popularity: aff * 0.9, query: { affinity: aff },
});

export const MOCK_ABROAD: Record<string, QEntity[]> = {
  Seoul: [
    e("Sogeum Bakehouse", "Seoul", "KR", 0.97, [T.bakery, T.saltbread, T.instagrammable, T.latte]),
    e("Haneul Salt Bread Lab", "Seoul", "KR", 0.93, [T.bakery, T.saltbread, T.croissant, T.cozy, T.kpop]),
    e("Cream Cloud Bakery", "Seoul", "KR", 0.88, [T.bakery, T.creambun, T.instagrammable]),
    e("Injeolmi House", "Seoul", "KR", 0.81, [T.cafe, T.injeolmi, T.latte, T.cozy]),
  ],
  "Mexico City": [
    e("Panadería Roma Norte", "Mexico City", "MX", 0.95, [T.bakery, T.pandulce, T.sourdough, T.brunch, T.cozy]),
    e("Conchas & Co.", "Mexico City", "MX", 0.9, [T.bakery, T.pandulce, T.instagrammable]),
    e("Olla Café", "Mexico City", "MX", 0.84, [T.cafe, T.cafedeolla, T.cozy, T.latte]),
  ],
  Lagos: [
    e("Puff Republic", "Lagos", "NG", 0.91, [T.bakery, T.puffpuff, T.instagrammable, T.afrobeats]),
    e("Zobo Bar Lekki", "Lagos", "NG", 0.86, [T.cafe, T.zobo, T.brunch, T.afrobeats, T.late, T.street]),
    e("Island Sweets", "Lagos", "NG", 0.8, [T.bakery, T.puffpuff, T.cozy]),
  ],
  Tokyo: [
    e("Melon Pan Koubou", "Tokyo", "JP", 0.92, [T.bakery, T.melonpan, T.cozy]),
    e("Hojicha Stand", "Tokyo", "JP", 0.89, [T.cafe, T.hojicha, T.latte, T.street]),
    e("Matcha Morning", "Tokyo", "JP", 0.7, [T.cafe, T.matcha, T.latte]),
  ],
};

/** How many fake "local" places carry each tag (drives scarcity). Matcha & croissant are saturated. */
export const MOCK_LOCAL_COUNTS: Record<string, number> = {
  [T.saltbread.id]: 2, [T.creambun.id]: 9, [T.pandulce.id]: 7, [T.puffpuff.id]: 1, [T.melonpan.id]: 4,
  [T.hojicha.id]: 6, [T.zobo.id]: 0, [T.cafedeolla.id]: 3, [T.injeolmi.id]: 2, [T.matcha.id]: 48, [T.croissant.id]: 50,
};

export const MOCK_LOCAL: QEntity[] = [
  e("Hudson Crumb", "Local", "US", 0.9, [T.bakery, T.croissant, T.latte, T.instagrammable, T.cozy]),
  e("Mile Square Coffee", "Local", "US", 0.85, [T.cafe, T.latte, T.matcha, T.brunch]),
  e("Washington St Sourdough", "Local", "US", 0.8, [T.bakery, T.sourdough, T.brunch, T.cozy]),
];

/** Fake week-over-week growth by tag (0..1). */
export const MOCK_MOMENTUM: Record<string, number> = {
  [T.saltbread.id]: 0.92, [T.creambun.id]: 0.6, [T.pandulce.id]: 0.7, [T.puffpuff.id]: 0.85, [T.melonpan.id]: 0.5,
  [T.hojicha.id]: 0.78, [T.zobo.id]: 0.74, [T.cafedeolla.id]: 0.55, [T.injeolmi.id]: 0.66, [T.matcha.id]: 0.4,
};

export function mockHeatmap(seed: string, lat = 40.744, lng = -74.032): HeatPoint[] {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const cx = rnd() * 6, cy = rnd() * 6, pts: HeatPoint[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const d = Math.hypot(i - cx, j - cy);
    pts.push({ lat: lat + (i - 4) * 0.004, lng: lng + (j - 4) * 0.004, affinity: Math.max(0.05, Math.min(1, 1 - d / 7 + rnd() * 0.15)) });
  }
  return pts;
}

/** Illustrations for mock-mode trends (generated with Qwen Image on ComfyUI; no real people). */
export const TREND_IMAGES: Record<string, { src: string; alt: string }> = {
  [T.saltbread.id]: { src: "/trends/salt-bread.webp", alt: "Korean salt bread rolls topped with sea salt, one torn open to show butter inside" },
  [T.pandulce.id]: { src: "/trends/pan-dulce.webp", alt: "Pink, vanilla and chocolate Mexican conchas on a bakery tray with coffee" },
  [T.puffpuff.id]: { src: "/trends/puff-puff.webp", alt: "Sugar-dusted Nigerian puff-puff in an enamel bowl on Ankara print cloth" },
};
