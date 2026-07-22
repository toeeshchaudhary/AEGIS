// Shared types for the AEGIS Agri-Tech dashboard.

export type Status =
  | "HEALTHY"
  | "IRRIGATE NOW"
  | "HEAT STRESS"
  | "FROST RISK"
  | "DISEASE RISK"
  | "FIRE RISK";

export interface Reading {
  nodeId: string;
  ts: number; // epoch ms (set by the server on ingest)
  temperature: number; // °C
  humidity: number; // %
  smoke: number; // MQ-2 raw ADC
  soilRaw: number; // soil raw ADC
  soilPct: number; // 0..100 moisture
  dhtOk: boolean;
  localStatus?: string; // what the node decided on-device
}

export interface Factor {
  label: string;
  weight: number; // contribution to risk (0..100)
  severity: "info" | "warn" | "critical";
}

export interface Evaluation {
  status: Status;
  risk: number; // 0..100
  message: string; // short, farmer-friendly advice
  factors: Factor[];
  source: "rule" | "ai";
}

export interface NodeState extends Reading {
  eval: Evaluation;
}

export interface AlertEntry {
  ts: number;
  nodeId: string;
  status: Status;
  risk: number;
  message: string;
}
