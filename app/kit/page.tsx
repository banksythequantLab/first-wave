"use client";
import { useEffect, useState } from "react";
import type { ScoutEvent, TrendCard } from "@/lib/types";
import Heatmap from "../Heatmap";

type Res = Extract<ScoutEvent, { type: "result" }>;
export default function Kit() {
  const [r, setR] = useState<Res | null>(null); const [k, setK] = useState<TrendCard | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("fw-result"); if (!raw) return;
    const res = JSON.parse(raw) as Res; const id = new URLSearchParams(location.search).get("id");
    setR(res); setK(res.cards.find((c) => c.id === id) ?? res.cards[0]);
  }, []);
  if (!r || !k || !k.kit) return <main className="wrap"><p>No scout result yet. <a href="/">Run a scout</a>.</p></main>;
  const x = k.kit;
  return <main className="wrap">
    <a href="/">← Back</a>
    <div className="brand" style={{ marginTop: 12 }}><span className="logo">🚀</span><div>
      <h1>Launch kit: {x.productName} {r.mock && <span className="mock">MOCK DATA</span>}</h1>
      <p>For {r.business.name}, {r.business.location} · origin {k.originCity}, {k.originCountry} · fit {k.fitScore}/100 · written by {x.source === "llm" ? "LLM" : "template (no LLM key)"}</p></div></div>
    <div className="kit" style={{ marginTop: 18 }}>
      <div className="panel"><h3>The product</h3><p>{x.description}</p><p><b>Price:</b> {x.price}</p></div>
      <div className="panel"><h3>Launch event</h3><p>{x.event}</p></div>
      <div className="panel"><h3>Instagram caption</h3><p>{x.caption}</p></div>
      <div className="panel"><h3>Community outreach</h3><p>{x.outreach}</p></div>
      <div className="panel"><h3>Credit &amp; respect</h3><p>{x.creditNote}</p></div>
      <div className="panel"><h3>Where to promote</h3><Heatmap points={k.heatmap} /></div>
    </div>
    <div className="panel"><h3 style={{ color: "var(--warm)" }}>Evidence</h3><ul>{k.whyItFits.map((w) => <li key={w}>{w}</li>)}</ul></div>
    <button style={{ marginTop: 14 }} onClick={() => window.print()}>Print / save PDF</button>
  </main>;
}
