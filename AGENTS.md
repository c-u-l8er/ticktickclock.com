# TickTickClock — Agent Interface

> **Nothing below is callable.** These are *declarations*: three capability
> contracts and their operations, as JSON in `records/contracts/` and as tables
> in `docs/spec/README.md` §6. There is no server, no MCP endpoint and no
> implementation — `build-site.mjs` recounts the implementation at zero lines on
> every build. "Transport: MCP v1" states what the contracts declare, not
> something a client can connect to, and the performance figures in §10 of the
> spec are targets rather than measurements.

TickTickClock is the temporal intelligence layer for the [&] Protocol ecosystem. It provides `&time` capabilities to AI agents.

## Capabilities

### &time.anomaly
- `detect` — detect anomalous events, spikes, drops, or drift from temporal input signals
- `enrich` — attach anomaly-derived temporal context to existing payloads
- `learn` — incorporate confirmed outcomes to improve future detection

### &time.forecast
- `predict` — generate forecasts over requested horizons from historical/streaming data
- `explain` — return explanation of forecast drivers, confidence, and contributing signals
- `enrich` — attach forecast-derived temporal context to decision payloads
- `learn` — incorporate realized outcomes for model calibration

### &time.pattern
- `detect` — detect recurring temporal structures (cycles, seasonality, motifs)
- `summarize` — summarize patterns into interpretable temporal structure
- `enrich` — attach recurring-pattern and seasonality context to analytical payloads

## Protocol Integration

- Accepts from: `&memory.*`, `&space.*`, raw data, time series, context
- Feeds into: `&reason.*`, `&memory.*`, `&space.*`, output
- A2A skills: temporal-anomaly-detection, temporal-forecasting, demand-prediction, trend-explanation, temporal-pattern-detection, seasonality-analysis
- Transport: MCP v1 (Streamable HTTP)
- Recommended streams: cpu, mem, latency, error_rate, throughput
- Recommended horizons: 1h, 24h, 7d
- Recommended windows: 24h, 7d, 30d

## Status

`spec` rung. The document exists and its operation tables agree with the
contract files; that is the whole of it. The spec's own Pre-Phase — FV-1
through FV-4, the four experiments that would say whether any of this is
buildable — has not been started, every task box in the roadmap is unticked,
and none of the nine performance targets has been measured. See
`docs/spec/README.md`, and the status block on the landing page.
