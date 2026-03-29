# TickTickClock — Agent Interface

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

Spec complete. Implementation pending. See `docs/spec/README.md`.
