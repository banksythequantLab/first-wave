import { runScout } from "@/lib/agent";
import type { Business, ScoutEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const replayCache = new Map<string, ScoutEvent[]>(); // private, in-memory

export async function POST(req: Request) {
  const body = (await req.json()) as Business & { replay?: boolean };
  const b: Business = { name: String(body.name || "").slice(0, 80), type: String(body.type || "bakery").slice(0, 40), location: String(body.location || "Hoboken").slice(0, 60) };
  const key = JSON.stringify(b);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (e: ScoutEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const cached = replayCache.get(key);
      if (body.replay && cached) {
        send({ type: "log", msg: "▶ Replaying cached demo run", t: 0 });
        for (const e of cached) { await new Promise((r) => setTimeout(r, e.type === "log" ? 220 : 0)); send(e); }
        return ctrl.close();
      }
      const rec: ScoutEvent[] = [];
      try {
        await runScout(b, (e) => { rec.push(e); send(e); });
        replayCache.set(key, rec);
      } catch (err) {
        send({ type: "log", msg: `❌ ${(err as Error).message}`, t: 0 });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
