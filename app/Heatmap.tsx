"use client";
import { useEffect, useRef } from "react";
import type { HeatPoint } from "@/lib/types";
import "leaflet/dist/leaflet.css";

/**
 * Qloo heatmap points over a real street basemap (CARTO light, free with attribution,
 * no API key). Leaflet is imported inside useEffect so it never runs during SSR.
 */
export default function Heatmap({ points, legend }: { points: HeatPoint[]; legend: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || !points.length) return;
    let map: import("leaflet").Map | undefined;
    let dead = false;
    import("leaflet").then((L) => {
      if (dead || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      for (const p of points) {
        L.circleMarker([p.lat, p.lng], { radius: 4 + p.affinity * 6, stroke: false, fillColor: color(p.affinity), fillOpacity: 0.25 + p.affinity * 0.45 })
          .bindTooltip(`Qloo affinity ${p.affinity.toFixed(2)}`).addTo(map);
      }
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [12, 12] });
    });
    return () => { dead = true; map?.remove(); };
  }, [points]);
  if (!points.length) return <p className="hint">No heatmap data returned.</p>;
  return <div>
    <div ref={el} className="map" role="img" aria-label={legend} />
    <div className="legend"><span className="ramp" /> {legend}: low → high</div>
  </div>;
}
export function color(a: number) { const h = 200 - a * 180; return `hsl(${h} 90% ${35 + a * 20}%)`; }
