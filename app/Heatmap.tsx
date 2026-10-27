"use client";
import type { HeatPoint } from "@/lib/types";
export default function Heatmap({ points }: { points: HeatPoint[] }) {
  if (!points.length) return <p className="hint">No heatmap data returned.</p>;
  const lats = [...new Set(points.map((p) => p.lat.toFixed(4)))].sort().reverse();
  const lngs = [...new Set(points.map((p) => p.lng.toFixed(4)))].sort();
  const small = lats.length <= 30 && lngs.length <= 30;
  if (small) {
    const m = new Map(points.map((p) => [`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`, p.affinity]));
    return <div className="heat" style={{ gridTemplateColumns: `repeat(${lngs.length},1fr)` }}>
      {lats.flatMap((la) => lngs.map((ln) => { const a = m.get(`${la},${ln}`) ?? 0; return <div key={la + ln} title={a.toFixed(2)} style={{ background: color(a) }} />; }))}
    </div>;
  }
  const [x0, x1] = [Math.min(...points.map((p) => p.lng)), Math.max(...points.map((p) => p.lng))];
  const [y0, y1] = [Math.min(...points.map((p) => p.lat)), Math.max(...points.map((p) => p.lat))];
  return <svg viewBox="0 0 100 100" style={{ width: "100%", background: "#04101a", borderRadius: 10 }}>
    {points.map((p, i) => <circle key={i} cx={((p.lng - x0) / (x1 - x0 || 1)) * 96 + 2} cy={98 - ((p.lat - y0) / (y1 - y0 || 1)) * 96} r={1.6} fill={color(p.affinity)} />)}
  </svg>;
}
function color(a: number) { const h = 200 - a * 180; return `hsl(${h} 90% ${20 + a * 40}%)`; }
