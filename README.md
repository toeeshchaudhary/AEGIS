# AEGIS — Agri-Tech for Sustainable Farming

> A low-cost, modular, AI-assisted field network that helps small farmers
> save water and protect crops — with plain-language alerts that work on any phone.

**Techathon 3.0 · Vision Venture** (Innovation Showcase, Classes IX–XII).

AEGIS puts a cheap, repairable **sensor node** in the field and keeps the
**intelligence in the cloud**. Each node reads soil moisture, temperature,
humidity and smoke; posts readings over Wi-Fi; and the cloud replies with a
status, a risk score and human-friendly advice — shown on the node's LCD, a
live dashboard, and (roadmap) as SMS.

```
Field Node (ESP32)  →  Wi-Fi / JSON  →  Cloud API (Next.js)
                                          ├─ rule engine  (instant status + risk)
                                          └─ AI advice     (Claude → plain language)
                                          →  Dashboard · SMS · LCD
```

## Repository layout
| Path | What |
|---|---|
| [`firmware/`](firmware/) | ESP32 Arduino sketch + wiring/calibration guide |
| [`dashboard/`](dashboard/) | Next.js + TypeScript cloud dashboard, ingest/rule/AI API, built-in demo simulator |
| [`deck/`](deck/) | Vision Venture pitch deck (HTML + exported PDF) |

## Quick start — dashboard
```sh
cd dashboard
pnpm install
pnpm dev            # http://localhost:3000
```
Open the dashboard and press **▶ Start live sim** to demo with no hardware, or
flash a node (see `firmware/README.md`) pointed at `POST /api/ingest`.

Optional AI advice: set `ANTHROPIC_API_KEY` (and optionally `AEGIS_MODEL`,
default `claude-haiku-4-5-20251001`). Without a key it uses built-in
template advice, so the demo always works offline.

## The pitch deck
Open `deck/index.html` (arrow keys / scroll to navigate) or view the exported
`deck/AEGIS-Vision-Venture.pdf`. Styled in the MTTA signage design system.

## Design principle
The node stays **dumb**, the cloud stays **smart**. The rule engine guarantees
fast, explainable safety decisions; the AI layer only *rephrases* them — so the
system keeps working even if the AI or the network is unavailable.
