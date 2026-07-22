// GET /api/state — everything the dashboard UI needs in one poll.

import { NextResponse } from "next/server";
import { getNodes, getAlerts, getHistory } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const nodes = getNodes();
  const history: Record<string, { ts: number; soilPct: number; temperature: number; smoke: number }[]> = {};
  for (const n of nodes) {
    history[n.nodeId] = getHistory(n.nodeId).map((r) => ({
      ts: r.ts,
      soilPct: r.soilPct,
      temperature: r.temperature,
      smoke: r.smoke,
    }));
  }
  return NextResponse.json({ nodes, alerts: getAlerts(), history, now: Date.now() });
}
