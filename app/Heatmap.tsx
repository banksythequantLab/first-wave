"use client";
import { useEffect, useRef } from "react";
import type { HeatPoint, Pin } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Qloo heatmap points over a real street basemap: OpenFreeMap "positron" vector style
 * (free, no key, commercial use OK — https://openfreemap.org). MapLibre adds the required
 * attribution (OpenFreeMap © OpenMapTiles Data from OpenStreetMap) automatically.
 * maplibre-gl is imported inside useEffect so it never runs during SSR.
 */
const STYLE = "https://tiles.openfreemap.org/styles/positron";

export const PIN_COLOR: Record<Pin["trend"], string> = { rising: "#16a34a", flat: "#64748b", falling: "#dc2626", unknown: "#a3a3a3" };

function pinPopup(p: Pin): HTMLElement {
  const d = document.createElement("div"); d.className = "pin-pop";
  const add = (tag: string, text: string) => { const x = document.createElement(tag); x.textContent = text; d.appendChild(x); return x; };
  add("b", p.name);
  if (p.address) add("div", p.address);
  add("div", `Qloo affinity ${p.affinity?.toFixed(2) ?? "n/a"} · audience growth ${p.growth?.toFixed(2) ?? "n/a"} (${p.trend})`);
  add("div", p.dishes.length ? `Known for: ${p.dishes.join(", ")}` : "No specialty-dish / menu-highlight tags in Qloo");
  return d;
}

export default function Heatmap({ points, legend, pins = [] }: { points: HeatPoint[]; legend: string; pins?: Pin[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || !points.length) return;
    let map: import("maplibre-gl").Map | undefined;
    let dead = false;
    import("maplibre-gl").then((ml) => {
      if (dead || !el.current) return;
      // Bundlers can't resolve MapLibre's worker; serve it from /public (vendored, BSD-3; `npm run prebuild` refreshes it).
      ml.setWorkerUrl("/maplibre-gl-worker.mjs");
      const lngs = points.map((p) => p.lng), lats = points.map((p) => p.lat);
      const bounds: [[number, number], [number, number]] = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
      const m = new ml.Map({ container: el.current, style: STYLE, bounds, fitBoundsOptions: { padding: 16 }, scrollZoom: false, cooperativeGestures: true, attributionControl: { compact: false } });
      map = m; m.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
      m.on("load", () => {
        if (!map) return;
        map.addSource("heat", { type: "geojson", data: { type: "FeatureCollection", features: points.map((p) => ({ type: "Feature", properties: { a: p.affinity }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) } });
        map.addLayer({ id: "heat", type: "circle", source: "heat", paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, ["+", 3, ["*", 5, ["get", "a"]]], 16, ["+", 8, ["*", 14, ["get", "a"]]]],
          "circle-color": ["interpolate", ["linear"], ["get", "a"], 0, "hsl(200,90%,35%)", 0.5, "hsl(110,90%,45%)", 1, "hsl(20,90%,55%)"],
          "circle-opacity": ["+", 0.25, ["*", 0.4, ["get", "a"]]],
        } }, m.getStyle().layers.find((l) => l.type === "symbol")?.id); // below labels so street names stay readable
        const pop = new ml.Popup({ closeButton: false, closeOnClick: false });
        map.on("mousemove", "heat", (e) => { const f = e.features?.[0]; if (f && map) pop.setLngLat(e.lngLat).setText(`Qloo affinity ${Number(f.properties.a).toFixed(2)}`).addTo(map); });
        map.on("mouseleave", "heat", () => pop.remove());
        if (pins.length) {
          map.addSource("pins", { type: "geojson", data: { type: "FeatureCollection", features: pins.map((p, i) => ({ type: "Feature", properties: { i, c: PIN_COLOR[p.trend] }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) } });
          map.addLayer({ id: "pins", type: "circle", source: "pins", paint: { "circle-radius": 7, "circle-color": ["get", "c"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
          const click = new ml.Popup({ maxWidth: "260px" });
          map.on("click", "pins", (e) => { const f = e.features?.[0]; if (f && map) click.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(pinPopup(pins[Number(f.properties.i)])).addTo(map); });
          map.on("mouseenter", "pins", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "pins", () => { if (map) map.getCanvas().style.cursor = ""; });
          (el.current as HTMLDivElement & { __map?: unknown }).__map = map; // for screenshots/tests
        }
      });
    });
    return () => { dead = true; map?.remove(); };
  }, [points, pins]);
  if (!points.length) return <p className="hint">No heatmap data returned.</p>;
  return <div>
    <div ref={el} className="map" role="img" aria-label={legend} />
    <div className="legend"><span className="ramp" /> {legend}: low → high</div>
    {pins.length > 0 && <div className="legend">Competitor pins (tap one) by Qloo audience growth: {(["rising", "flat", "falling", "unknown"] as const).map((k) => <span key={k}><span className="dot" style={{ background: PIN_COLOR[k] }} />{k} </span>)}</div>}
  </div>;
}
