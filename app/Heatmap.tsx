"use client";
import { useEffect, useRef } from "react";
import type { HeatPoint } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Qloo heatmap points over a real street basemap: OpenFreeMap "positron" vector style
 * (free, no key, commercial use OK — https://openfreemap.org). MapLibre adds the required
 * attribution (OpenFreeMap © OpenMapTiles Data from OpenStreetMap) automatically.
 * maplibre-gl is imported inside useEffect so it never runs during SSR.
 */
const STYLE = "https://tiles.openfreemap.org/styles/positron";

export default function Heatmap({ points, legend }: { points: HeatPoint[]; legend: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || !points.length) return;
    let map: import("maplibre-gl").Map | undefined;
    let dead = false;
    import("maplibre-gl").then((ml) => {
      if (dead || !el.current) return;
      // Bundlers can't resolve MapLibre's worker; serve it from /public (copied by `prebuild`).
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
        } });
        const pop = new ml.Popup({ closeButton: false, closeOnClick: false });
        map.on("mousemove", "heat", (e) => { const f = e.features?.[0]; if (f && map) pop.setLngLat(e.lngLat).setText(`Qloo affinity ${Number(f.properties.a).toFixed(2)}`).addTo(map); });
        map.on("mouseleave", "heat", () => pop.remove());
      });
    });
    return () => { dead = true; map?.remove(); };
  }, [points]);
  if (!points.length) return <p className="hint">No heatmap data returned.</p>;
  return <div>
    <div ref={el} className="map" role="img" aria-label={legend} />
    <div className="legend"><span className="ramp" /> {legend}: low → high</div>
  </div>;
}
