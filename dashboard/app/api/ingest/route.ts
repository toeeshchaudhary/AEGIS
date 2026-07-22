// POST /api/ingest — the ESP32 node posts raw readings here.
// Response is the small JSON the node displays on its LCD.

import { NextResponse } from "next/server";
import { evaluate } from "@/lib/rules";
import { generateAdvice } from "@/lib/advice";
import { record } from "@/lib/store";
import type { Reading } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Partial<Reading>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const reading: Reading = {
    nodeId: body.nodeId || "field-a",
    ts: Date.now(),
    temperature: Number(body.temperature ?? 0),
    humidity: Number(body.humidity ?? 0),
    smoke: Number(body.smoke ?? 0),
    soilRaw: Number(body.soilRaw ?? 0),
    soilPct: Number(body.soilPct ?? 0),
    dhtOk: Boolean(body.dhtOk ?? true),
    localStatus: body.localStatus,
  };

  const ev = await generateAdvice(reading, evaluate(reading));
  record(reading, ev);

  // Keep the node payload tiny — it only needs these three.
  return NextResponse.json({ status: ev.status, risk: ev.risk, message: ev.message });
}
