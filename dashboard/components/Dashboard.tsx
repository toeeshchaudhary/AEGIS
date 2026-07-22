"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sparkline from "./Sparkline";
import type { NodeState, AlertEntry } from "@/lib/types";

interface StateResp {
  nodes: NodeState[];
  alerts: AlertEntry[];
  history: Record<string, { ts: number; soilPct: number; temperature: number; smoke: number }[]>;
  now: number;
}

type Sev = "ok" | "warn" | "crit";

function severity(status: string): Sev {
  if (status === "HEALTHY") return "ok";
  if (status === "FIRE RISK" || status === "FROST RISK") return "crit";
  return "warn";
}
const sevClass = { ok: "s-ok", warn: "s-warn", crit: "s-crit" } as const;
const sevColor = { ok: "#4ade80", warn: "#fbbf24", crit: "#f87171" } as const;

function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}
function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Dashboard() {
  const [data, setData] = useState<StateResp | null>(null);
  const [sel, setSel] = useState<string>("");
  const [demo, setDemo] = useState(false);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      setData(await r.json());
    } catch {
      /* transient */
    }
  }, []);

  const sim = useCallback(
    async (scenario: string) => {
      const nodeId = sel || "field-a";
      await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeId, scenario }),
      });
      refresh();
    },
    [sel, refresh]
  );

  const resetAll = useCallback(async () => {
    setDemo(false);
    await fetch("/api/reset", { method: "POST" });
    refresh();
  }, [refresh]);

  // Poll state every 2s.
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  // Demo mode: drift the selected node every 2.5s (auto narrative).
  useEffect(() => {
    if (demo) {
      sim("auto");
      demoTimer.current = setInterval(() => sim("auto"), 2500);
    } else if (demoTimer.current) {
      clearInterval(demoTimer.current);
      demoTimer.current = null;
    }
    return () => {
      if (demoTimer.current) clearInterval(demoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const nodes = data?.nodes ?? [];
  const active = nodes.find((n) => n.nodeId === sel) ?? nodes[0];
  const activeId = active?.nodeId;
  const hist = activeId ? data?.history[activeId] ?? [] : [];
  const now = data?.now ?? Date.now();

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <ShieldLeaf />
          <div>
            <h1>AEGIS</h1>
            <div className="sub">
              <span className="tag">Agri-Tech</span> field monitor · sustainable farming
            </div>
          </div>
        </div>
        <span className="pill">
          <span className={`dot ${nodes.length ? "live" : ""}`} />
          {nodes.length ? `${nodes.length} node${nodes.length > 1 ? "s" : ""} online` : "waiting for nodes…"}
        </span>
      </header>

      <div className="controls">
        <span className="label">Demo</span>
        <button className={`primary ${demo ? "on" : ""}`} onClick={() => setDemo((d) => !d)}>
          {demo ? "◼ Stop live sim" : "▶ Start live sim"}
        </button>
        <span className="label" style={{ marginLeft: 8 }}>Trigger</span>
        <button onClick={() => sim("healthy")}>Healthy</button>
        <button onClick={() => sim("dry")}>Dry soil</button>
        <button onClick={() => sim("hot")}>Heat</button>
        <button onClick={() => sim("frost")}>Frost</button>
        <button onClick={() => sim("disease")}>Humid</button>
        <button onClick={() => sim("fire")}>🔥 Fire</button>
        <button className="danger ghost" style={{ marginLeft: "auto" }} onClick={resetAll}>
          Reset
        </button>
      </div>

      {nodes.length > 1 && (
        <div className="tabs">
          {nodes.map((n) => (
            <button key={n.nodeId} className={`tab ${n.nodeId === activeId ? "on" : ""}`} onClick={() => setSel(n.nodeId)}>
              {n.nodeId}
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <div className="card col-12" style={{ gridColumn: "span 12" }}>
          <div className="empty">
            No data yet. Press <b>▶ Start live sim</b> to demo without hardware, or flash a node pointed at{" "}
            <code>/api/ingest</code>.
          </div>
        </div>
      ) : (
        <div className="grid">
          <StatusHero node={active} now={now} />

          <Metric className="col-3" title="Soil moisture" value={active.soilPct} unit="%" sub={`raw ${active.soilRaw}`} bar={active.soilPct} barColor={active.soilPct < 30 ? sevColor.warn : sevColor.ok} />
          <Metric className="col-3" title="Air temp" value={active.dhtOk ? Math.round(active.temperature) : "—"} unit="°C" sub={active.dhtOk ? "" : "sensor error"} />
          <Metric className="col-3" title="Humidity" value={active.dhtOk ? Math.round(active.humidity) : "—"} unit="%" />
          <Metric className="col-3" title="Smoke / gas" value={Math.round(active.smoke)} unit="" sub={active.smoke > 2200 ? "fire threshold!" : "MQ-2 raw"} valueColor={active.smoke > 2200 ? sevColor.crit : undefined} />

          <div className="card col-8">
            <h3>Trends · {activeId}</h3>
            <div style={{ marginTop: 10 }}>
              <Sparkline values={hist.map((h) => h.soilPct)} min={0} max={100} color={sevColor.ok} fill="#4ade8014" />
            </div>
            <div style={{ marginTop: 6 }}>
              <Sparkline values={hist.map((h) => h.smoke)} min={0} max={3500} color={sevColor.crit} fill="#f8717112" />
            </div>
            <div className="chart-legend">
              <span><i style={{ background: sevColor.ok }} />Soil moisture %</span>
              <span><i style={{ background: sevColor.crit }} />Smoke (raw)</span>
              <span style={{ marginLeft: "auto", color: "var(--faint)" }}>{hist.length} samples</span>
            </div>
          </div>

          <div className="card col-4">
            <h3>Alert history</h3>
            <ul className="alerts">
              {(data?.alerts ?? []).length === 0 && <div className="empty">No alerts — all fields healthy.</div>}
              {(data?.alerts ?? []).map((a, i) => {
                const sv = severity(a.status);
                return (
                  <li className="alert" key={a.ts + "-" + i}>
                    <span className="t">{clock(a.ts)}</span>
                    <div className="body">
                      <div className="st" style={{ color: sevColor[sv] }}>
                        {a.status} · {a.nodeId} · {a.risk}%
                      </div>
                      <div className="ms">{a.message}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="foot">
        <b>AEGIS</b> — low-cost · modular · repairable field nodes → Wi-Fi → cloud rule engine + AI advice → SMS &amp; dashboard.<br />
        Techathon 3.0 · Vision Venture · Agri-Tech for Sustainable Farming
      </div>
    </div>
  );
}

function StatusHero({ node, now }: { node: NodeState; now: number }) {
  const sv = severity(node.eval.status);
  const color = sevColor[sv];
  return (
    <div className="card col-8">
      <h3>Field status</h3>
      <div className="hero">
        <RiskGauge risk={node.eval.risk} color={color} />
        <div className="hero-main">
          <span className={`badge ${sevClass[sv]}`}>
            <span className="fdot" style={{ background: color }} />
            {node.eval.status}
          </span>
          <p className="status-msg">
            <span className="who">AEGIS:</span> {node.eval.message}
          </p>
          <ul className="factors">
            {node.eval.factors.length === 0 && (
              <li><span className="fdot" style={{ background: sevColor.ok }} />All readings within healthy range</li>
            )}
            {node.eval.factors.map((f, i) => (
              <li key={i}>
                <span className="fdot" style={{ background: f.severity === "critical" ? sevColor.crit : f.severity === "warn" ? sevColor.warn : "var(--faint)" }} />
                {f.label}
              </li>
            ))}
          </ul>
          <div className="src">
            {node.eval.source === "ai" ? "advice by Claude · " : "rule-engine advice · "}
            updated {timeAgo(node.ts, now)}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskGauge({ risk, color }: { risk: number; color: string }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const off = c * (1 - risk / 100);
  return (
    <div className="gauge">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={r} fill="none" stroke="#16211a" strokeWidth="12" />
        <circle
          cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 66 66)" style={{ transition: "stroke-dashoffset .6s ease, stroke .3s" }}
        />
      </svg>
      <div className="num">
        <div>
          <b style={{ color }}>{risk}</b>
          <small>risk score</small>
        </div>
      </div>
    </div>
  );
}

function Metric({
  className, title, value, unit, sub, bar, barColor, valueColor,
}: {
  className: string; title: string; value: number | string; unit: string;
  sub?: string; bar?: number; barColor?: string; valueColor?: string;
}) {
  return (
    <div className={`card ${className}`}>
      <h3>{title}</h3>
      <div className="metric">
        <span className="val" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      {bar !== undefined && (
        <div className="bar">
          <span style={{ width: `${Math.min(100, Math.max(0, bar))}%`, background: barColor ?? sevColor.ok }} />
        </div>
      )}
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function ShieldLeaf() {
  return (
    <svg className="mark" viewBox="0 0 48 48" fill="none">
      <path d="M24 3 L41 10 V23 C41 34 33 42 24 45 C15 42 7 34 7 23 V10 Z" fill="#0f1611" stroke="#4ade80" strokeWidth="2" />
      <path d="M24 13 C29 17 31 24 24 34 C17 24 19 17 24 13 Z" fill="#4ade80" opacity="0.9" />
      <line x1="24" y1="17" x2="24" y2="33" stroke="#0f1611" strokeWidth="1.4" />
    </svg>
  );
}
