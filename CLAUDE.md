# TickTickClock — Temporal Intelligence Layer

Time-series continual learning engine. The `&time` primitive provider for the [&] Protocol ecosystem.

## Source-of-truth spec

- `docs/spec/README.md` — TickTickClock technical specification

## [&] Capabilities provided

| Capability | Contract | Operations |
|---|---|---|
| `&time.anomaly` | `AmpersandBoxDesign/contracts/v0.1.0/time.anomaly.contract.json` | detect, enrich, learn |
| `&time.forecast` | `AmpersandBoxDesign/contracts/v0.1.0/time.forecast.contract.json` | predict, explain, enrich, learn |
| `&time.pattern` | `AmpersandBoxDesign/contracts/v0.1.0/time.pattern.contract.json` | detect, summarize, enrich |

## Key technologies

- Selective State-Space Models (Mamba architecture) for anomaly detection
- Epoch-aware delta-CRDTs for convergent temporal state
- Multi-timescale consolidation (Nested Learning / Titans-inspired)
- Continual Compositionality & Orchestration (CCO)
- MCP-first API design

## Paired with

- **GeoFleetic** — spatial intelligence (when + where = complete situational awareness)
- **Graphonomous** — continual learning substrate
- **Delegatic** — governance enforcement for temporal operations

## Status

This is a spec + marketing site. No implementation code yet. Implementation will be Elixir/OTP.
