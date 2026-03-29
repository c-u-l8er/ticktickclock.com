# TickTickClock Documentation

> **Every tick is a learning opportunity. Every pattern has a rhythm. Temporal intelligence that never forgets.**

Welcome to the documentation hub for **TickTickClock** — the temporal intelligence
layer for the [&] Protocol ecosystem. TickTickClock provides time-series anomaly
detection, forecasting, and pattern recognition as continual learning services.

TickTickClock is the `&time` primitive provider, exposing `&time.anomaly`,
`&time.forecast`, and `&time.pattern` capability contracts. It does not store
business data, host agents, or manage workflows — it ingests temporal signals,
learns their structure continuously, and returns intelligence to upstream consumers.

---

## The Problem

Time-series intelligence in production systems is fragmented. Anomaly detection
runs as a batch job. Forecasting lives in a notebook. Pattern detection is a
dashboard someone checks on Mondays. None of these systems learn continuously,
and none of them talk to each other.

Meanwhile, underlying models suffer from catastrophic forgetting — retrained
monthly on a window of recent data, discarding everything about long-range
seasonality. Multi-timescale temporal behavior requires multi-timescale memory,
and no production system provides it.

TickTickClock solves this with:
- **Continual learning** — models update at inference time, no batch retraining
- **Multi-timescale memory** — fast (seconds), medium (hours), slow (days), glacial (months)
- **Streaming-first** — designed for unbounded streams, not fixed datasets
- **Edge-capable** — SQLite + Bumblebee on constrained devices

---

## Documentation Map


```{toctree}
:maxdepth: 1
:caption: Homepages

[&] Ampersand Box <https://ampersandboxdesign.com>
Graphonomous <https://graphonomous.com>
BendScript <https://bendscript.com>
WebHost.Systems <https://webhost.systems>
Agentelic <https://agentelic.com>
AgenTroMatic <https://agentromatic.com>
Delegatic <https://delegatic.com>
Deliberatic <https://deliberatic.com>
FleetPrompt <https://fleetprompt.com>
GeoFleetic <https://geofleetic.com>
OpenSentience <https://opensentience.org>
SpecPrompt <https://specprompt.com>
TickTickClock <https://ticktickclock.com>
```

```{toctree}
:maxdepth: 1
:caption: Root Docs

[&] Protocol Docs <https://docs.ampersandboxdesign.com>
Graphonomous Docs <https://docs.graphonomous.com>
BendScript Docs <https://docs.bendscript.com>
WebHost.Systems Docs <https://docs.webhost.systems>
Agentelic Docs <https://docs.agentelic.com>
AgenTroMatic Docs <https://docs.agentromatic.com>
Delegatic Docs <https://docs.delegatic.com>
Deliberatic Docs <https://docs.deliberatic.com>
FleetPrompt Docs <https://docs.fleetprompt.com>
GeoFleetic Docs <https://docs.geofleetic.com>
OpenSentience Docs <https://docs.opensentience.org>
SpecPrompt Docs <https://docs.specprompt.com>
TickTickClock Docs <https://docs.ticktickclock.com>
```

```{toctree}
:maxdepth: 2
:caption: TickTickClock Docs

spec/README
```

---

## [&] Capability Contracts

| Capability | Operations | Description |
|-----------|------------|-------------|
| `&time.anomaly` | detect, enrich, learn | Adaptive anomaly detection via selective state-space models |
| `&time.forecast` | predict, explain, enrich, learn | Multi-timescale forecasting with continual learning |
| `&time.pattern` | detect, summarize, enrich | Cycle and motif detection via spectral analysis |

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `anomaly_detect` | Run anomaly detection on a temporal stream |
| `anomaly_subscribe` | Subscribe to real-time anomaly events |
| `forecast_predict` | Generate forecasts with confidence intervals |
| `forecast_explain` | Explain forecast reasoning |
| `pattern_detect` | Detect cycles and motifs in time series |
| `pattern_summarize` | Summarize detected patterns |
| `temporal_enrich` | Enrich external data with temporal context |
| `temporal_learn` | Submit outcome data for model updates |

---

## Architecture at a Glance

| Component | Role | OTP Pattern |
|-----------|------|-------------|
| **Anomaly Engine** | Adaptive SSM (Mamba-style) with selective state gating | GenServer per stream |
| **Forecast Engine** | Multi-timescale CCO prediction, no forgetting | GenServer + Nx |
| **Pattern Engine** | Spectral + autocorrelation cycle detection | Concurrent tasks |
| **Multi-Timescale Store** | Fast (ETS) → Medium → Slow → Glacial memory | Tiered storage |
| **Stream Dashboard** | Anomaly timeline, forecast explorer, pattern viewer | Phoenix LiveView |

### Multi-Timescale Memory

| Tier | Latency | Storage | Contents |
|------|---------|---------|----------|
| **Fast** | seconds | ETS | Per-tick state snapshots |
| **Medium** | hours | SQLite/TimescaleDB | Aggregated state vectors |
| **Slow** | days | SQLite/TimescaleDB | Consolidated summaries |
| **Glacial** | months | SQLite/TimescaleDB | Long-range seasonal models |

---

## Paired With

| Product | Relationship |
|---------|-------------|
| **GeoFleetic** | Spatial intelligence — when + where = complete situational awareness |
| **Graphonomous** | Continual learning substrate for temporal knowledge |
| **Delegatic** | Governance enforcement for temporal operations |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Elixir 1.17+ |
| Framework | Phoenix 1.8+ |
| Database | PostgreSQL 16+ + TimescaleDB |
| Edge Storage | SQLite |
| ML | Bumblebee / Nx (SSM, CCO models) |
| Replication | Epoch-aware delta-CRDTs |

---

## Project Links

- **Spec:** [Technical Specification](spec/README.md)
- **[&] Protocol ecosystem:** `AmpersandBoxDesign/`

---

*[&] Ampersand Box Design — ticktickclock.com*
