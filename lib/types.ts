export type Business = { name: string; type: string; location: string };
export type Tag = { id: string; name: string; type?: string };
export type QEntity = {
  entity_id: string; name: string; subtype?: string;
  properties?: { address?: string; geocode?: { name?: string; country_code?: string } };
  location?: { lat: number; lon: number };
  tags?: Tag[]; popularity?: number | null; query?: { affinity?: number; measurements?: { audience_growth?: number } };
};
export type HeatPoint = { lat: number; lng: number; affinity: number };
export type Evidence = { name: string; city: string; affinity: number; entity_id: string };
export type ScoreParts = { abroad: number; momentum: number; usRarity: number; scarcity: number; fit: number };
export type LaunchKit = {
  productName: string; description: string; price: string; event: string;
  caption: string; outreach: string; creditNote: string; source: "llm" | "template";
};
export type TrendCard = {
  id: string; trend: string; tagId: string; originCity: string; originCountry: string;
  fitScore: number; parts: ScoreParts; momentumAvailable: boolean;
  evidence: Evidence[]; localCount: number;
  /** Places carrying the tag per US benchmark city (live only). */
  usCounts?: Record<string, number>; whyItFits: string[];
  heatmap: HeatPoint[]; kit?: LaunchKit;
  /** "category" when the dish heatmap was empty and the business-type heatmap is shown instead. */
  heatmapLevel?: "dish" | "category";
  /** Optional illustration under /public, e.g. /trends/salt-bread.webp */
  image?: string; imageAlt?: string;
};
export type Pin = { id: string; name: string; address?: string; lat: number; lng: number; affinity?: number; popularity?: number; growth?: number; trend: "rising" | "flat" | "falling" | "unknown"; dishes: string[] };
export type HeatLayer = { label: string; tagId: string; points: HeatPoint[] };
export type Demographics = { label: string; age: Record<string, number>; gender: Record<string, number> };
export type Overlays = { pins: Pin[]; layers: HeatLayer[]; demographics: Demographics | null; center?: { lat: number; lng: number } };
export type ScoutEvent =
  | { type: "log"; msg: string; t: number }
  | { type: "result"; cards: TrendCard[]; mock: boolean; profile: string[]; business: Business }
  | { type: "overlays"; overlays: Overlays };
