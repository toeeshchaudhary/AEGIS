// AEGIS advice layer.
//
// Turns a rule-engine Evaluation into a short, farmer-friendly message.
//
// - Default path is a deterministic TEMPLATE — always works, zero cost,
//   works offline. This is what runs during the demo unless a key is set.
// - Optional AI path: if ANTHROPIC_API_KEY is set, we ask Claude to phrase
//   the same facts more naturally (e.g. for SMS). The AI only *rewrites*;
//   the rule engine already decided status + risk, so safety never depends
//   on the model being reachable.

import type { Reading, Evaluation } from "./types";

// Fast + cheap model, ideal for one-line advice. Override with AEGIS_MODEL.
const MODEL = process.env.AEGIS_MODEL || "claude-haiku-4-5-20251001";

export function templateMessage(r: Reading, ev: Evaluation): string {
  switch (ev.status) {
    case "FIRE RISK":
      return `Smoke very high near ${r.nodeId}. Possible field fire — check immediately and keep water/soil ready.`;
    case "FROST RISK":
      return `Frost risk at ${r.temperature.toFixed(0)}°C. Protect sensitive crops tonight (cover / light irrigation).`;
    case "HEAT STRESS":
      return `Heat stress at ${r.temperature.toFixed(0)}°C. Irrigate early morning or evening to reduce crop stress.`;
    case "DISEASE RISK":
      return `Warm and humid (${r.humidity.toFixed(0)}%). Fungal disease likely — improve airflow, avoid over-watering.`;
    case "IRRIGATE NOW":
      return `Soil moisture low (${r.soilPct}%). Irrigate ${r.nodeId} now; avoid over-watering to save water.`;
    default:
      return `All good at ${r.nodeId}. Soil ${r.soilPct}%, ${r.temperature.toFixed(0)}°C, ${r.humidity.toFixed(0)}% humidity. No action needed.`;
  }
}

export async function generateAdvice(r: Reading, ev: Evaluation): Promise<Evaluation> {
  const fallback = templateMessage(r, ev);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ...ev, message: fallback, source: "rule" };

  try {
    const facts = ev.factors.map((f) => `- ${f.label}`).join("\n") || "- No issues detected";
    const prompt =
      `You are AEGIS, an assistant for small farmers. Given sensor facts, write ONE ` +
      `short SMS-style line (max 22 words), plain and actionable. No emojis, no jargon.\n\n` +
      `Node: ${r.nodeId}\nStatus: ${ev.status} (risk ${ev.risk}%)\n` +
      `Soil: ${r.soilPct}%  Temp: ${r.temperature.toFixed(0)}°C  Humidity: ${r.humidity.toFixed(0)}%\n` +
      `Facts:\n${facts}\n\nAdvice:`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
      }),
      // Keep the demo snappy: never block the node's response for long.
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return { ...ev, message: fallback, source: "rule" };
    const data = await res.json();
    const text: string = data?.content?.[0]?.text?.trim();
    return text
      ? { ...ev, message: text, source: "ai" }
      : { ...ev, message: fallback, source: "rule" };
  } catch {
    return { ...ev, message: fallback, source: "rule" };
  }
}
