import "server-only";
import type { Business, TrendCard, LaunchKit } from "./types";

const COUNTRY: Record<string, { adj: string; diaspora: string }> = {
  KR: { adj: "Korean", diaspora: "Korean-American" }, MX: { adj: "Mexican", diaspora: "Mexican-American" },
  NG: { adj: "Nigerian", diaspora: "Nigerian-American" }, JP: { adj: "Japanese", diaspora: "Japanese-American" },
  FR: { adj: "French", diaspora: "French-American" }, GB: { adj: "British", diaspora: "British-American" },
};

export function templateKit(b: Business, k: TrendCard): LaunchKit {
  const c = COUNTRY[k.originCountry] ?? { adj: k.originCity, diaspora: `${k.originCity} diaspora` };
  const trend = k.trend.replace(/^\[MOCK\]\s*/, "");
  return {
    productName: `${trend}, ${c.adj}-style (inspired by ${k.originCity})`,
    description: `A ${b.type} take on ${trend}, a favorite that's taking off in ${k.originCity}. Made with respect for its ${c.adj} roots.`,
    price: /bar/i.test(b.type) ? "$12–14" : "$4.50–6.50 each; $18 for a 4-pack",
    event: `"${k.originCity} Saturday" launch tasting at ${b.name}: free samples 10am–noon, ${c.adj} playlist, a short story card on where ${trend} comes from.`,
    caption: `Straight from ${k.originCity} to ${b.location} 🌊 ${trend} lands at ${b.name} this Saturday. Come taste what ${k.originCity} is obsessed with. #FirstWave #${trend.replace(/[^a-z0-9]/gi, "")}`,
    outreach: `Invite a local ${c.diaspora} baker, chef, or community group to co-host the launch, taste-test the recipe, and get credited (and paid) for their input.`,
    creditNote: `Name the item by its original name, tell customers it comes from ${c.adj} food culture, and don't trademark the traditional name.`,
    source: "template",
  };
}

/** Pluggable OpenAI-compatible LLM (LLM_API_KEY, LLM_BASE_URL, LLM_MODEL). Falls back to the template. */
export async function writeKit(b: Business, k: TrendCard): Promise<LaunchKit> {
  const fallback = templateKit(b, k);
  const key = process.env.LLM_API_KEY;
  if (!key) return fallback;
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const prompt = `You write launch kits for US small businesses adopting a trend from abroad, crediting the origin culture respectfully.
Business: ${JSON.stringify(b)}
Trend (from Qloo data): ${JSON.stringify({ trend: k.trend, origin: k.originCity, country: k.originCountry, evidence: k.evidence, why: k.whyItFits })}
Only use facts given above. Return JSON with keys: productName, description, price, event, caption, outreach, creditNote.`;
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.7, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    const out = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return { ...fallback, ...out, source: "llm" };
  } catch { return fallback; }
}
