// AEGIS rule engine — the fast, deterministic "brain".
//
// Runs on every incoming reading and produces an instant status + risk score.
// This is intentionally simple and explainable: for a farmer (and for the
// judges) it must be obvious *why* a warning fired. The AI layer (advice.ts)
// only rewrites this into friendly language — it never overrides the safety
// logic, so the system stays trustworthy even if the AI is unavailable.

import type { Reading, Evaluation, Factor, Status } from "./types";

export const THRESHOLDS = {
  soilIrrigateBelowPct: 30,
  soilDrySoonPct: 45,
  heatStressAboveC: 40,
  warmAboveC: 33,
  frostRiskBelowC: 4,
  highHumidityPct: 85,
  smokeAlertAbove: 2200,
  smokeWatchAbove: 1600,
};

export function evaluate(r: Reading): Evaluation {
  const factors: Factor[] = [];

  // --- Fire / smoke (safety first) ---
  if (r.smoke > THRESHOLDS.smokeAlertAbove) {
    factors.push({ label: "Smoke very high — possible field fire", weight: 70, severity: "critical" });
  } else if (r.smoke > THRESHOLDS.smokeWatchAbove) {
    factors.push({ label: "Smoke rising — watch for fire", weight: 25, severity: "warn" });
  }

  // --- Temperature extremes ---
  if (r.dhtOk && r.temperature < THRESHOLDS.frostRiskBelowC) {
    factors.push({ label: `Frost risk (${r.temperature.toFixed(0)}°C)`, weight: 55, severity: "critical" });
  } else if (r.dhtOk && r.temperature > THRESHOLDS.heatStressAboveC) {
    factors.push({ label: `Heat stress (${r.temperature.toFixed(0)}°C)`, weight: 45, severity: "warn" });
  } else if (r.dhtOk && r.temperature > THRESHOLDS.warmAboveC) {
    factors.push({ label: `Warm (${r.temperature.toFixed(0)}°C) — crops use more water`, weight: 12, severity: "info" });
  }

  // --- Soil moisture (the core agri signal) ---
  if (r.soilPct < THRESHOLDS.soilIrrigateBelowPct) {
    factors.push({ label: `Soil dry (${r.soilPct}%) — needs water`, weight: 50, severity: "warn" });
  } else if (r.soilPct < THRESHOLDS.soilDrySoonPct) {
    factors.push({ label: `Soil drying (${r.soilPct}%)`, weight: 18, severity: "info" });
  }

  // --- Fungal / disease pressure (warm + very humid) ---
  if (r.dhtOk && r.humidity > THRESHOLDS.highHumidityPct && r.temperature > THRESHOLDS.warmAboveC) {
    factors.push({ label: `High humidity (${r.humidity.toFixed(0)}%) + warmth — fungal risk`, weight: 30, severity: "warn" });
  }

  // Risk = combine factors, capped at 100 (critical factors dominate).
  const risk = Math.min(100, factors.reduce((s, f) => s + f.weight, 0));

  // Status priority: fire > frost > heat > disease > irrigate > healthy.
  const status: Status = pickStatus(r);

  return { status, risk, message: "", factors, source: "rule" };
}

function pickStatus(r: Reading): Status {
  if (r.smoke > THRESHOLDS.smokeAlertAbove) return "FIRE RISK";
  if (r.dhtOk && r.temperature < THRESHOLDS.frostRiskBelowC) return "FROST RISK";
  if (r.dhtOk && r.temperature > THRESHOLDS.heatStressAboveC) return "HEAT STRESS";
  if (
    r.dhtOk &&
    r.humidity > THRESHOLDS.highHumidityPct &&
    r.temperature > THRESHOLDS.warmAboveC
  )
    return "DISEASE RISK";
  if (r.soilPct < THRESHOLDS.soilIrrigateBelowPct) return "IRRIGATE NOW";
  return "HEALTHY";
}
