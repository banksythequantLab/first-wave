"use client";
import { useRef, useState } from "react";
import type { ScoutEvent, TrendCard, Business, Overlays } from "@/lib/types";
import Heatmap from "./Heatmap";

const TYPES = ["bakery", "cafe", "bar", "boutique"];
const LABEL: Record<string, string> = { abroad: "Abroad affinity", momentum: "Momentum", usRarity: "US rarity", scarcity: "Local scarcity", fit: "Local fit" };

export default function Home() {
  const [b, setB] = useState<Business>({ name: "Washington St Bakery", type: "bakery", location: "Hoboken" });
  const [logs, setLogs] = useState<{ msg: string; t: number }[]>([]);
  const [cards, setCards] = useState<TrendCard[]>([]);
  const [mock, setMock] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<TrendCard | null>(null);
  const [ov, setOv] = useState<Overlays | null>(null);
  const [layer, setLayer] = useState<string>("trend");
  const logRef = useRef<HTMLDivElement>(null);

  async function scout(replay = false) {
    setBusy(true); setLogs([]); setCards([]); setSel(null); setFlipped({}); setOv(null); setLayer("trend");
    const r = await fetch("/api/scout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, replay }) });
    const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop()!;
      for (const l of lines) if (l.trim()) {
        const e = JSON.parse(l) as ScoutEvent;
        if (e.type === "log") { setLogs((x) => [...x, e]); if (e.msg.includes("MOCK")) setMock(true); requestAnimationFrame(() => logRef.current?.scrollTo(0, 1e9)); }
        else if (e.type === "overlays") setOv(e.overlays);
        else { setCards(e.cards); setMock(e.mock); setProfile(e.profile); sessionStorage.setItem("fw-result", JSON.stringify(e)); }
      }
    }
    setBusy(false);
  }

  return <main className="wrap">
    <div className="brand"><span className="logo">🌊</span><div>
      <h1>First Wave {mock && <span className="mock">MOCK DATA — fake fixtures</span>}</h1>
      <p>Find what&apos;s taking off abroad before it lands in the US, matched to your block&apos;s taste. Powered by Qloo.</p></div></div>

    <form className="form" onSubmit={(e) => { e.preventDefault(); scout(); }}>
      <input aria-label="Business name" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Business name" />
      <select aria-label="Type" value={b.type} onChange={(e) => setB({ ...b, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      <input aria-label="City or neighborhood" value={b.location} onChange={(e) => setB({ ...b, location: e.target.value })} placeholder="City / neighborhood" />
      <button disabled={busy}>{busy ? "Scouting…" : "Scout trends"}</button>
      <button type="button" className="ghost" disabled={busy} onClick={() => scout(true)}>Replay demo</button>
    </form>

    <div className="grid">
      <div><div className="log" ref={logRef}>{logs.length ? logs.map((l, i) => <div key={i}><span className="t">{(l.t / 1000).toFixed(1)}s</span>{l.msg}</div>) : <span style={{ color: "#4d7390" }}>Agent log appears here…</span>}</div>
        {profile.length > 0 && <div className="panel"><b>Local taste profile</b><div>{profile.slice(0, 8).map((p) => <span className="tag" key={p}>{p}</span>)}</div></div>}
      </div>
      <div>
        {cards.length ? <div className="cards">{cards.map((k) => <div key={k.id} className={`card ${flipped[k.id] ? "flipped" : ""}`} onClick={() => { setFlipped((f) => ({ ...f, [k.id]: !f[k.id] })); setSel(k); }}>
          <div className="inner">
            <div className="face">{k.image ? <img className="trend-img" src={k.image} alt={k.imageAlt ?? `${k.trend} from ${k.originCity}`} loading="lazy" /> : null}<div className="origin">📍 {k.originCity}, {k.originCountry}</div><div className="trend">{k.trend}</div>
              <div className="bars">{Object.entries(k.parts).map(([n, v]) => <div key={n}>{LABEL[n]}<i><u style={{ width: `${v * 100}%` }} /></i>{n === "momentum" && !k.momentumAvailable ? "n/a" : (v * 100).toFixed(0)}</div>)}</div>
              <div className="score"><b>{k.fitScore}</b><span>fit score<br />tap to flip</span></div></div>
            <div className="face back"><h4>Why it fits</h4><ul>{k.whyItFits.map((w) => <li key={w}>{w}</li>)}</ul>
              <h4>Qloo evidence</h4><ul>{k.evidence.map((e) => <li key={e.entity_id}>{e.name} — affinity {e.affinity.toFixed(2)}</li>)}</ul>
              <a href={`/kit?id=${encodeURIComponent(k.id)}`} onClick={(e) => e.stopPropagation()}>Open launch kit →</a></div>
          </div></div>)}</div>
          : <div className="empty">{busy ? "Scouting the world…" : "Enter a business and hit Scout. You'll get 3 trends from abroad with fit scores, evidence, and a launch kit."}</div>}
        {sel && (() => {
          const L = layer === "trend" ? null : ov?.layers.find((l) => l.tagId === layer);
          const pts = L ? L.points : sel.heatmap;
          const legend = L ? `${L.label}-fan density (Qloo affinity, category level)` : sel.heatmapLevel === "category" ? "Bakery-fan density (Qloo affinity, category level)" : `${sel.trend}-fan density (Qloo affinity)`;
          return <div className="panel"><b>{L ? `Where ${L.label} fans cluster in ${b.location}` : `Where ${sel.trend} fans cluster in ${b.location}`}</b> <span className="hint">(Qloo heatmap{mock ? ", MOCK" : ""})</span>
            {ov && ov.layers.length > 0 && <div style={{ marginTop: 6 }}><label className="hint">Heatmap layer{" "}
              <select aria-label="Heatmap layer" value={layer} onChange={(e) => setLayer(e.target.value)}>
                <option value="trend">{sel.heatmapLevel === "category" ? "Business type (default)" : `${sel.trend} (default)`}</option>
                {ov.layers.filter((l, i) => l.tagId !== sel.tagId && !(i === 0 && sel.heatmapLevel === "category")).map((l) => <option key={l.tagId} value={l.tagId}>{l.label}</option>)}
              </select></label></div>}
            {!L && sel.heatmapLevel === "category" && <p className="hint">Qloo had no dish-level heatmap for {sel.trend} here, so this shows category-level Bakery-fan density.</p>}
            {L && <p className="hint">Category-level layer: where fans of {L.label} places cluster, not fans of a specific dish.</p>}
            <div style={{ maxWidth: 520, marginTop: 10 }}><Heatmap points={pts} legend={legend} pins={ov?.pins ?? []} /></div>
            {!ov && busy && <p className="hint">Loading competitor pins and layers…</p>}
            {ov?.demographics && <div className="demo"><b>Who likes this category</b> <span className="hint">(Qloo demographics for {ov.demographics.label}; national skew vs. average, not specific to {b.location})</span>
              <div className="demo-rows">{Object.entries({ ...ov.demographics.age, ...ov.demographics.gender }).map(([k, v]) => <div key={k}><span>{k.replace(/_/g, " ")}</span><i><u style={{ width: `${Math.abs(v) * 50}%`, marginLeft: v < 0 ? `${50 - Math.abs(v) * 50}%` : "50%", background: v < 0 ? "#dc2626" : "#16a34a" }} /></i><span>{v > 0 ? "+" : ""}{v.toFixed(2)}</span></div>)}</div></div>}
          </div>;
        })()}
      </div>
    </div>
    <footer>Trends are credited to their origin cultures. Data: Qloo Insights API{mock ? " (currently MOCK fixtures, not real Qloo data)" : ""}. MIT licensed.</footer>
  </main>;
}
