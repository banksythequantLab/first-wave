export type Business = { name: string; type: string; location: string };
export type Tag = { id: string; name: string; type?: string };
export type QEntity = {
  entity_id: string; name: string; subtype?: string;
  properties?: { address?: string; geocode?: { name?: string; country_code?: string } };
  tags?: Tag[]; popularity?: number | null; query?: { affinity?: number; measurements?: { audience_growth?: number } };
};
export type HeatPoint = { lat: number; lng: number; affinity: number };
export type Evidence = { name: string; city: string; affinity: number; entity_id: string };
export type ScoreParts = { abroad: number; momentum: number; scarcity: number; fit: number };
export type LaunchKit = {
  productName: string; description: string; price: string; event: string;
  caption: string; outreach: string; creditNote: string; source: "llm" | "template";
};
export type TrendCard = {
  id: string; trend: string; tagId: string; originCity: string; originCountry: string;
  fitScore: number; parts: ScoreParts; momentumAvailable: boolean;
  evidence: Evidence[]; localCount: number; whyItFits: string[];
  heatmap: HeatPoint[]; kit?: LaunchKit;
  /** Optional illustration under /public, e.g. /trends/salt-bread.webp */
  image?: string; imageAlt?: string;
};
export type ScoutEvent =
  | { type: "log"; msg: string; t: number }
  | { type: "result"; cards: TrendCard[]; mock: boolean; profile: string[]; business: Business };
