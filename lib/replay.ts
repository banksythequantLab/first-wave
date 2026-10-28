import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Business, ScoutEvent } from "./types";

/**
 * Private, server-side replay cache of a finished run (allowed by the Qloo guide).
 * Stored under data/replay/ which is GITIGNORED: Qloo's terms forbid putting
 * Qloo response data in a public repo. Never contains the API key.
 */
const DIR = process.env.REPLAY_DIR || path.join(process.cwd(), "data", "replay");
const file = (b: Business) => path.join(DIR, `${[b.name, b.type, b.location].join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);

export function sanitize(events: ScoutEvent[]): ScoutEvent[] {
  const key = process.env.QLOO_API_KEY;
  const txt = JSON.stringify(events).replace(/hack_[A-Za-z0-9]+/g, "[redacted]");
  return JSON.parse(key ? txt.split(key).join("[redacted]") : txt);
}

export async function saveReplay(b: Business, events: ScoutEvent[]): Promise<void> {
  const res = events.find((e) => e.type === "result");
  if (!res || res.mock) return; // only cache real live runs
  try { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(file(b), JSON.stringify(sanitize(events), null, 1)); } catch { /* read-only FS (e.g. Vercel) */ }
}

export async function loadReplay(b: Business): Promise<ScoutEvent[] | null> {
  try { return JSON.parse(await fs.readFile(file(b), "utf8")) as ScoutEvent[]; } catch { return null; }
}
