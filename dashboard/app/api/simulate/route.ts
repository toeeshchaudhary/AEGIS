// POST /api/simulate — inject a synthetic reading so the dashboard demos
// fully without hardware. Drives the SAME pipeline as /api/ingest, so what
// the judges see is exactly what a real node would produce.
//
// Body: { nodeId?, scenario? }
//   scenario: "healthy" | "drying" | "dry" | "hot" | "frost" | "disease"
//             | "fire" | "auto" (default — slowly drifts to tell a story)

import { NextResponse } from "next/server";
import { evaluate } from "@/lib/rules";
import { generateAdvice } from "@/lib/advice";
import { record, getHistory } from "@/lib/store";
import type { Reading } from "@/lib/types";

export const dynamic = "force-dynamic";

const jitter = (base: number, spread: number) => base + (Math.random() - 0.5) * spread;

function scenarioReading(nodeId: string, scenario: string): Reading {
  const base = {
    nodeId,
    ts: Date.now(),
    dhtOk: true,
  };
  switch (scenario) {
    case "dry":
      return { ...base, temperature: jitter(34, 2), humidity: jitter(38, 6), smoke: jitter(700, 200), soilRaw: 2900, soilPct: Math.round(jitter(22, 6)) };
    case "drying":
      return { ...base, temperature: jitter(31, 2), humidity: jitter(45, 6), smoke: jitter(650, 200), soilRaw: 2400, soilPct: Math.round(jitter(40, 5)) };
    case "hot":
      return { ...base, temperature: jitter(43, 1.5), humidity: jitter(30, 5), smoke: jitter(700, 200), soilRaw: 2600, soilPct: Math.round(jitter(35, 6)) };
    case "frost":
      return { ...base, temperature: jitter(2.5, 1.5), humidity: jitter(70, 8), smoke: jitter(500, 150), soilRaw: 1800, soilPct: Math.round(jitter(60, 8)) };
    case "disease":
      return { ...base, temperature: jitter(35, 1.5), humidity: jitter(90, 4), smoke: jitter(600, 150), soilRaw: 1700, soilPct: Math.round(jitter(62, 8)) };
    case "fire":
      return { ...base, temperature: jitter(38, 3), humidity: jitter(35, 6), smoke: jitter(2900, 300), soilRaw: 2500, soilPct: Math.round(jitter(38, 6)) };
    case "healthy":
    default:
      return { ...base, temperature: jitter(28, 2), humidity: jitter(60, 6), smoke: jitter(550, 200), soilRaw: 1600, soilPct: Math.round(jitter(68, 6)) };
  }
}

// "auto" drifts soil moisture down over successive samples so a single demo
// toggle naturally walks HEALTHY -> soil drying -> IRRIGATE NOW.
function autoReading(nodeId: string): Reading {
  const hist = getHistory(nodeId);
  const lastPct = hist.length ? hist[hist.length - 1].soilPct : 70;
  const soilPct = Math.max(12, Math.round(lastPct - jitter(4, 2)));
  const soilRaw = Math.round(3200 - (soilPct / 100) * 2000);
  return {
    nodeId,
    ts: Date.now(),
    temperature: jitter(30, 2.5),
    humidity: jitter(55, 8),
    smoke: jitter(650, 250),
    soilRaw,
    soilPct,
    dhtOk: true,
  };
}

export async function POST(req: Request) {
  let body: { nodeId?: string; scenario?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const nodeId = body.nodeId || "field-a";
  const scenario = body.scenario || "auto";

  const reading = scenario === "auto" ? autoReading(nodeId) : scenarioReading(nodeId, scenario);
  const ev = await generateAdvice(reading, evaluate(reading));
  const state = record(reading, ev);

  return NextResponse.json(state);
}
