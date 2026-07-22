// In-memory store for readings + alerts. Kept on globalThis so it survives
// Next.js dev hot-reloads. For a hackathon demo this is plenty; swap for
// Prisma/SQLite or Firebase later without touching the API surface.

import type { NodeState, Reading, AlertEntry, Evaluation } from "./types";

interface Store {
  nodes: Map<string, NodeState>;
  history: Map<string, Reading[]>; // per-node ring buffer
  alerts: AlertEntry[];
}

const g = globalThis as unknown as { __aegis?: Store };

const store: Store =
  g.__aegis ??
  (g.__aegis = {
    nodes: new Map(),
    history: new Map(),
    alerts: [],
  });

const HISTORY_LEN = 60; // ~last 60 samples per node
const ALERTS_LEN = 40;

export function record(reading: Reading, ev: Evaluation): NodeState {
  const state: NodeState = { ...reading, eval: ev };
  store.nodes.set(reading.nodeId, state);

  const hist = store.history.get(reading.nodeId) ?? [];
  hist.push(reading);
  if (hist.length > HISTORY_LEN) hist.shift();
  store.history.set(reading.nodeId, hist);

  // Log an alert entry only when the status is not HEALTHY and it changed,
  // so the history reads like real events rather than every poll.
  const last = store.alerts[0];
  if (
    ev.status !== "HEALTHY" &&
    (!last || last.nodeId !== reading.nodeId || last.status !== ev.status)
  ) {
    store.alerts.unshift({
      ts: reading.ts,
      nodeId: reading.nodeId,
      status: ev.status,
      risk: ev.risk,
      message: ev.message,
    });
    if (store.alerts.length > ALERTS_LEN) store.alerts.pop();
  }

  return state;
}

export function getNodes(): NodeState[] {
  return [...store.nodes.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}

export function getHistory(nodeId: string): Reading[] {
  return store.history.get(nodeId) ?? [];
}

export function getAlerts(): AlertEntry[] {
  return store.alerts;
}

export function reset() {
  store.nodes.clear();
  store.history.clear();
  store.alerts = [];
}
