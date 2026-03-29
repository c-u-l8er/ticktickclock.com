# TickTickClock — Temporal Intelligence Engine
## Technical Specification v0.1

**Date:** March 25, 2026
**Status:** Draft
**Author:** [&] Ampersand Box Design
**License:** MIT (open core)
**Stack:** Elixir · OTP · Phoenix · Ecto · PostgreSQL + TimescaleDB

---

## 1. Overview

TickTickClock is the **temporal intelligence layer** for the [&] Protocol ecosystem. It provides time-series anomaly detection, forecasting, and pattern recognition as continual learning services — exposed as `&time.anomaly`, `&time.forecast`, and `&time.pattern` capability contracts. Every tick is a learning opportunity. Every pattern has a rhythm.

TickTickClock does not store business data, host agents, or manage workflows. It ingests temporal signals, learns their structure continuously, and returns anomalies, forecasts, and patterns to upstream consumers via MCP tools. It is the `&time` primitive provider — the temporal complement to Graphonomous (`&memory`) and GeoFleetic (`&space`).

### 1.1 The Problem

Time-series intelligence in production systems is fragmented. Anomaly detection runs as a batch job in a separate pipeline. Forecasting lives in a notebook. Pattern detection is a dashboard someone checks on Mondays. None of these systems learn continuously from the signals they monitor, and none of them talk to each other. When an infrastructure incident happens at 3 AM, the anomaly detector fires an alert, but the forecasting model has no idea, and the pattern detector won't notice the recurrence until next quarter's review.

Meanwhile, the underlying models suffer from catastrophic forgetting — retrained monthly on a window of recent data, discarding everything the previous model learned about long-range seasonality. Multi-timescale temporal behavior (hourly spikes, weekly cycles, quarterly trends) requires multi-timescale memory, and no production system provides it.

### 1.2 Design Principles

1. **Continual learning** — Models update at inference time. No batch retraining. No forgetting.
2. **Multi-timescale memory** — Fast (seconds), medium (hours), slow (days), glacial (months). Each timescale consolidates independently.
3. **Streaming-first** — Designed for unbounded streams, not fixed datasets. Backfill is supported but not the primary path.
4. **MCP-first API** — Every capability is an MCP tool. No REST API needed unless you want one.
5. **Edge-capable** — SQLite + Bumblebee models run on constrained devices. TimescaleDB for server mode.
6. **Conflict-free replication** — Multi-node sync via epoch-aware delta-CRDTs. Convergence under arbitrary network conditions.
7. **Composable with [&]** — Implements `&time.*` contracts. Composes with `&memory.*`, `&space.*`, `&reason.*` via the [&] Protocol.

### 1.3 Why Elixir

Streaming time-series processing maps directly to OTP patterns. Each monitored stream is a GenServer process. Anomaly detection runs as a supervised pipeline stage. Multi-timescale memory consolidation is a set of GenServers ticking at different intervals — fast memory every second, slow memory every hour — supervised by the same application tree. The BEAM scheduler handles tens of thousands of concurrent streams without thread pool tuning. Phoenix PubSub delivers real-time anomaly events to subscribers with zero additional infrastructure. Delta-CRDT replication between nodes uses native distributed Erlang or `libcluster` for discovery.

### 1.4 One-Liner

> "Every tick is a learning opportunity. Every pattern has a rhythm. Temporal intelligence that never forgets."

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        TICKTICKCLOCK                              │
│                  Temporal Intelligence Engine                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   MCP Server (Hermes)               Phoenix LiveView (optional)    │
│   ├── anomaly_detect                 └── Stream dashboard          │
│   ├── anomaly_subscribe              └── Anomaly timeline          │
│   ├── forecast_predict               └── Forecast explorer         │
│   ├── forecast_explain               └── Pattern viewer            │
│   ├── pattern_detect                                               │
│   ├── pattern_summarize                                            │
│   ├── temporal_enrich                                              │
│   └── temporal_learn                                               │
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│   │  Anomaly Engine  │  │  Forecast Engine │  │  Pattern Engine  │  │
│   │                  │  │                  │  │                  │  │
│   │  Adaptive SSM    │  │  Multi-timescale │  │  Cycle & motif   │  │
│   │  (Mamba-style)   │  │  CCO prediction  │  │  detection via   │  │
│   │  Selective state  │  │  Fast→slow       │  │  spectral +      │  │
│   │  gating on each  │  │  memory promote  │  │  autocorrelation  │  │
│   │  stream tick     │  │  No forgetting   │  │  analysis         │  │
│   └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│            │                     │                      │            │
│   ┌────────▼─────────────────────▼──────────────────────▼─────────┐  │
│   │              Multi-Timescale Memory Store                      │  │
│   │                                                                │  │
│   │  Fast (ETS)        │ seconds  │ per-tick state snapshots       │  │
│   │  Medium (SQLite/TS) │ hours    │ aggregated state vectors       │  │
│   │  Slow (SQLite/TS)   │ days     │ consolidated summaries         │  │
│   │  Glacial (SQLite/TS) │ months   │ long-range seasonal models     │  │
│   └────────────────────────┬───────────────────────────────────────┘  │
│                            │                                         │
│   ┌────────────────────────▼───────────────────────────────────────┐  │
│   │              CRDT Replication Layer                             │  │
│   │                                                                │  │
│   │  Epoch-aware delta-CRDTs · ACI merge functions                 │  │
│   │  Convergence under reorder, delay, partition                   │  │
│   │  Distributed Erlang / libcluster for node discovery            │  │
│   └────────────────────────┬───────────────────────────────────────┘  │
│                            │                                         │
├────────────────────────────┼─────────────────────────────────────────┤
│   Storage Layer            │                                         │
│   ├── TimescaleDB (server) │  Hypertables, continuous aggregates     │
│   ├── SQLite (edge)        │  Single-file, embedded                  │
│   ├── ETS (hot cache)      │  Fast-memory ring buffers               │
│   └── DETS (warm cache)    │  Spill from ETS on memory pressure      │
└────────────────────────────┘─────────────────────────────────────────┘
```

### 2.1 Component Summary

| Component | Responsibility | OTP Pattern |
|-----------|---------------|-------------|
| `TickTickClock.AnomalyEngine` | Adaptive state-space anomaly detection on streaming data. Selective gating per tick. | GenServer per stream |
| `TickTickClock.ForecastEngine` | Multi-timescale prediction via Continual Compositionality & Orchestration. | GenServer per forecast context |
| `TickTickClock.PatternEngine` | Cycle detection, seasonality analysis, motif extraction. | GenServer per analysis window |
| `TickTickClock.MemoryStore` | Multi-timescale memory (fast/medium/slow/glacial). Promotion and consolidation. | Supervisor over timescale GenServers |
| `TickTickClock.StreamManager` | Manages concurrent stream ingestion. One GenServer per stream. Backpressure via Broadway. | DynamicSupervisor + Broadway |
| `TickTickClock.CRDTReplicator` | Epoch-aware delta-CRDT sync between nodes. ACI merge. | GenServer + distributed Erlang |
| `TickTickClock.MCP.Server` | MCP tool/resource exposure via Hermes. | Hermes.Server |
| `TickTickClock.Consolidator` | Promotes fast memory to slow memory during idle periods. Prunes expired state. | GenServer + `:timer` |

### 2.2 OTP Supervision Tree

```
TickTickClock.Application
├── TickTickClock.Repo (Ecto / TimescaleDB or SQLite)
├── TickTickClockWeb.Endpoint (Phoenix)
├── TickTickClock.MCP.Server (Hermes MCP)
├── TickTickClock.MemoryStore.Supervisor
│   ├── TickTickClock.MemoryStore.Fast (ETS owner, ring buffers)
│   ├── TickTickClock.MemoryStore.Medium (GenServer, hourly aggregation)
│   ├── TickTickClock.MemoryStore.Slow (GenServer, daily consolidation)
│   └── TickTickClock.MemoryStore.Glacial (GenServer, monthly models)
├── TickTickClock.StreamManager (DynamicSupervisor)
│   ├── TickTickClock.Stream ("cpu:host-01" — GenServer)
│   ├── TickTickClock.Stream ("latency:api-gw" — GenServer)
│   └── TickTickClock.Stream ("error_rate:checkout" — GenServer)
├── TickTickClock.AnomalyEngine.Supervisor (DynamicSupervisor)
│   ├── TickTickClock.AnomalyEngine ("cpu:host-01")
│   └── TickTickClock.AnomalyEngine ("latency:api-gw")
├── TickTickClock.ForecastEngine.Supervisor (DynamicSupervisor)
├── TickTickClock.PatternEngine.Supervisor (DynamicSupervisor)
├── TickTickClock.Consolidator (timed promotion cycles)
├── TickTickClock.CRDTReplicator (delta-CRDT sync)
└── Phoenix.PubSub (anomaly event broadcasts)
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Language** | Elixir 1.17+ / OTP 27 | Fault-tolerant concurrent stream processing. GenServer-per-stream. Distributed Erlang for CRDT replication. |
| **MCP Server** | `hermes_mcp` (v0.8+) | Most mature Elixir MCP SDK. Streamable HTTP transport. JSON-RPC 2.0 compliant. |
| **Framework** | Phoenix 1.8+ | LiveView for real-time dashboards. PubSub for anomaly event delivery. Channels for stream subscriptions. |
| **Time-Series DB (server)** | PostgreSQL 16+ / TimescaleDB | Hypertables with automatic partitioning. Continuous aggregates for medium/slow/glacial tiers. Compression for cold data. |
| **Embedded DB (edge)** | SQLite via `exqlite` | Zero-config, single-file. Edge deployments on constrained hardware. |
| **SSM Models** | Bumblebee + ONNX | Local Mamba-style selective state-space models via Nx/ONNX runtime. No EXLA dependency (consistent with portfolio convention). |
| **Hot Cache** | ETS | Fast-memory ring buffers. Per-stream state snapshots. Read concurrency enabled. Sub-microsecond lookups. |
| **Warm Cache** | DETS | Spill target for ETS under memory pressure. Disk-backed but still fast. |
| **Background Jobs** | Oban | Scheduled consolidation, CRDT sync retries, stale stream cleanup. |
| **Telemetry** | `:telemetry` + Prometheus | Stream throughput, anomaly detection latency, forecast accuracy, memory tier sizes. |
| **Deployment** | Mix release + Docker | Single BEAM node or clustered via `libcluster`. |

---

## 4. Core Engines

### 4.1 Anomaly Engine — Adaptive State-Space Detection

Inspired by the Mamba architecture (Gu & Dao, 2023), the anomaly engine uses selective state-space models with adaptive gating to process streaming temporal data in linear time.

**Key properties:**
- Linear-time sequence modeling (O(n) in sequence length, not O(n^2) like attention)
- Selective gating: each tick updates or ignores state dimensions based on input-dependent gate values
- Captures both short-range transients (CPU spike) and long-range dependencies (weekly seasonality)
- Runs as an Nx-backed ONNX model via Bumblebee (no EXLA)

```elixir
defmodule TickTickClock.AnomalyEngine do
  use GenServer

  @moduledoc """
  Per-stream anomaly detection using adaptive state-space models.
  Each stream gets its own GenServer with independent SSM state.
  """

  defstruct [
    :stream_id,
    :ssm_state,        # Selective state-space hidden state (Nx tensor)
    :gate_params,      # Adaptive gating parameters
    :threshold,        # Dynamic threshold (updated via EMA)
    :tick_count,       # Total ticks processed
    :last_anomaly_at   # Timestamp of most recent anomaly
  ]

  def init(%{stream_id: stream_id}) do
    state = %__MODULE__{
      stream_id: stream_id,
      ssm_state: initialize_ssm_state(),
      gate_params: load_gate_params(stream_id),
      threshold: initial_threshold(),
      tick_count: 0,
      last_anomaly_at: nil
    }
    {:ok, state}
  end

  def handle_cast({:tick, value, timestamp}, state) do
    # 1. Compute input-dependent gate
    gate = compute_selective_gate(value, state.gate_params)

    # 2. Update SSM state (selective: gate controls which dims update)
    new_ssm = selective_state_update(state.ssm_state, value, gate)

    # 3. Compute reconstruction / predicted value
    predicted = ssm_output(new_ssm)

    # 4. Score = deviation from prediction
    score = anomaly_score(value, predicted)

    # 5. Adaptive threshold (exponential moving average of scores)
    new_threshold = update_threshold(state.threshold, score)

    # 6. If anomalous, broadcast via PubSub
    if score > new_threshold * @sensitivity_multiplier do
      anomaly = %{
        stream_id: state.stream_id,
        timestamp: timestamp,
        value: value,
        predicted: predicted,
        score: score,
        threshold: new_threshold
      }
      Phoenix.PubSub.broadcast(
        TickTickClock.PubSub,
        "anomaly:#{state.stream_id}",
        {:anomaly_detected, anomaly}
      )
      TickTickClock.MemoryStore.record_anomaly(anomaly)
    end

    {:noreply, %{state |
      ssm_state: new_ssm,
      threshold: new_threshold,
      tick_count: state.tick_count + 1
    }}
  end
end
```

**Invariants:**
- One GenServer per stream. Streams are identified by `stream_id` (e.g., `"cpu:host-01"`).
- SSM state is never shared between streams. Each stream has independent learned dynamics.
- Anomaly threshold adapts to the stream's own baseline, not a global threshold.
- Gate parameters are persisted to storage on consolidation and restored on stream restart.

### 4.2 Forecast Engine — Continual Compositionality & Orchestration (CCO)

The forecast engine implements multi-timescale memory modules updating at different frequencies, inspired by Nested Learning (NeurIPS 2025) and the Titans architecture. Fast memory captures recent dynamics. Slow memory captures long-range trends. Forecasts compose across timescales.

```elixir
defmodule TickTickClock.ForecastEngine do
  use GenServer

  @moduledoc """
  Multi-timescale forecasting via Continual Compositionality.
  Memory modules at different frequencies compose into forecasts.
  """

  defstruct [
    :context_id,
    :fast_memory,     # Updates every tick. Short-horizon dynamics.
    :medium_memory,   # Updates every ~60 ticks. Medium trends.
    :slow_memory,     # Updates every ~1440 ticks. Daily/weekly patterns.
    :glacial_memory,  # Updates every ~43200 ticks. Seasonal models.
    :horizon_config   # Supported horizons: 1h, 24h, 7d
  ]

  @doc """
  Generate forecast over requested horizon.
  Composes predictions from all memory timescales.
  """
  def handle_call({:predict, horizon}, _from, state) do
    # 1. Query each timescale for its contribution
    fast_pred = TickTickClock.Memory.Fast.predict(state.fast_memory, horizon)
    medium_pred = TickTickClock.Memory.Medium.predict(state.medium_memory, horizon)
    slow_pred = TickTickClock.Memory.Slow.predict(state.slow_memory, horizon)
    glacial_pred = TickTickClock.Memory.Glacial.predict(state.glacial_memory, horizon)

    # 2. Compose: weight by horizon relevance
    #    Short horizons favor fast memory. Long horizons favor slow/glacial.
    weights = horizon_weights(horizon)
    forecast = compose_forecast([
      {fast_pred, weights.fast},
      {medium_pred, weights.medium},
      {slow_pred, weights.slow},
      {glacial_pred, weights.glacial}
    ])

    # 3. Compute confidence intervals from per-timescale uncertainty
    confidence = compute_confidence(forecast, state)

    result = %{
      horizon: horizon,
      values: forecast.values,
      timestamps: forecast.timestamps,
      confidence_lower: confidence.lower,
      confidence_upper: confidence.upper,
      contributing_timescales: weights
    }

    {:reply, {:ok, result}, state}
  end

  @doc """
  Incorporate outcome feedback. Adjusts timescale weights
  and memory contents without full retraining.
  """
  def handle_cast({:learn, observation}, state) do
    # Update the timescale whose horizon matches the observation window
    timescale = match_timescale(observation.window)
    new_state = update_memory(state, timescale, observation)
    {:noreply, new_state}
  end
end
```

**Memory promotion (consolidation):**

```
Fast Memory (ETS, seconds)
    │
    ├── Every 60s: summarize → promote to Medium
    │
Medium Memory (DB, hours)
    │
    ├── Every 1h: consolidate → promote to Slow
    │
Slow Memory (DB, days)
    │
    ├── Every 24h: compress → promote to Glacial
    │
Glacial Memory (DB, months)
    └── Persistent. Never discarded. Seasonal models live here.
```

### 4.3 Pattern Engine — Temporal Structure Detection

The pattern engine detects recurring temporal structures: seasonality, trend cycles, motifs, and anomaly recurrence. It combines spectral analysis (FFT for periodicity), autocorrelation (lag detection), and motif discovery (subsequence matching via Matrix Profile).

```elixir
defmodule TickTickClock.PatternEngine do
  use GenServer

  defstruct [
    :context_id,
    :window,           # Analysis window: 24h, 7d, 30d
    :spectral_state,   # Running FFT accumulator
    :acf_state,        # Autocorrelation function state
    :motif_index,      # Matrix Profile index for motif detection
    :known_patterns    # Previously detected patterns (for recurrence)
  ]

  def handle_call({:detect, time_series, window}, _from, state) do
    # 1. Spectral analysis: dominant frequencies
    frequencies = spectral_decompose(time_series, window)

    # 2. Autocorrelation: significant lags
    lags = compute_acf(time_series, max_lag: window_to_lags(window))

    # 3. Motif discovery: recurring subsequences
    motifs = matrix_profile_motifs(time_series, subsequence_length: auto_length(window))

    # 4. Match against known patterns for recurrence detection
    recurrences = match_known_patterns(state.known_patterns, frequencies, lags, motifs)

    patterns = %{
      seasonality: extract_seasonal(frequencies, lags),
      trend_cycles: extract_trends(frequencies),
      motifs: motifs,
      recurrences: recurrences,
      window: window,
      confidence: pattern_confidence(frequencies, lags)
    }

    {:reply, {:ok, patterns}, update_known_patterns(state, patterns)}
  end

  def handle_call({:summarize, pattern_set}, _from, state) do
    summary = %{
      dominant_period: strongest_period(pattern_set.seasonality),
      trend_direction: trend_direction(pattern_set.trend_cycles),
      recurring_count: length(pattern_set.recurrences),
      narrative: generate_narrative(pattern_set)
    }
    {:reply, {:ok, summary}, state}
  end
end
```

---

## 5. CRDT Replication — Epoch-Aware Delta Sync

Multi-node TickTickClock deployments synchronize via epoch-aware delta-CRDTs, based on the GeoCoCo 2025 framework. Each node maintains local state and periodically exchanges deltas. ACI (Associative, Commutative, Idempotent) merge functions guarantee convergence under arbitrary message reordering, delays, and network partitions.

```elixir
defmodule TickTickClock.CRDTReplicator do
  use GenServer

  @moduledoc """
  Epoch-aware delta-CRDT replication between TickTickClock nodes.
  Guarantees convergence under arbitrary reordering, delays, partitions.
  """

  defstruct [
    :node_id,
    :epoch,            # Logical epoch counter
    :pending_deltas,   # Deltas not yet acknowledged by peers
    :peer_epochs,      # Map of peer_id → last known epoch
    :merge_fun         # ACI merge function
  ]

  @doc """
  Merge incoming delta from peer. ACI properties guarantee:
  - Associative: merge(merge(a, b), c) == merge(a, merge(b, c))
  - Commutative: merge(a, b) == merge(b, a)
  - Idempotent:  merge(a, a) == a
  """
  def handle_cast({:receive_delta, peer_id, peer_epoch, delta}, state) do
    if peer_epoch > Map.get(state.peer_epochs, peer_id, 0) do
      merged_state = aci_merge(state, delta)
      new_peer_epochs = Map.put(state.peer_epochs, peer_id, peer_epoch)
      {:noreply, %{merged_state | peer_epochs: new_peer_epochs}}
    else
      # Already seen this epoch — idempotent, safe to ignore
      {:noreply, state}
    end
  end

  defp aci_merge(state, delta) do
    # Anomaly thresholds: MAX (most conservative wins)
    # Forecast weights: WEIGHTED AVERAGE by tick count
    # Pattern models: UNION of known patterns
    # Memory summaries: LATEST epoch wins (LWW per timescale)
    state.merge_fun.(state, delta)
  end
end
```

**Convergence guarantees:**
- Under network partition: each node continues processing locally. On reconnect, delta exchange brings all nodes to identical state.
- Under message reordering: ACI merge produces identical result regardless of delivery order.
- Under message duplication: idempotent merge. Applying the same delta twice is a no-op.
- Epoch tracking prevents processing stale deltas from slow peers.

---

## 6. [&] Capability Contracts

TickTickClock implements three [&] Protocol capability contracts:

### 6.1 `&time.anomaly`

| Operation | Input | Output | Side Effects |
|-----------|-------|--------|--------------|
| `detect` | `stream_data` | `anomaly_set` | No |
| `enrich` | `context` | `enriched_context` | No |
| `learn` | `observation` | `ack` | Yes — updates SSM state and threshold |

**Recommended streams:** `cpu`, `mem`, `latency`, `error_rate`, `throughput`
**Use cases:** infrastructure incidents, support volume spikes, regional demand anomalies, fleet telemetry

### 6.2 `&time.forecast`

| Operation | Input | Output | Side Effects |
|-----------|-------|--------|--------------|
| `predict` | `time_series` | `forecast_set` | No |
| `explain` | `forecast_set` | `forecast_explanation` | No |
| `enrich` | `context` | `enriched_context` | No |
| `learn` | `observation` | `ack` | Yes — updates timescale memory |

**Recommended horizons:** `1h`, `24h`, `7d`
**Use cases:** demand spike prediction, capacity planning, incident volume forecasting

### 6.3 `&time.pattern`

| Operation | Input | Output | Side Effects |
|-----------|-------|--------|--------------|
| `detect` | `time_series` | `pattern_set` | No |
| `summarize` | `pattern_set` | `pattern_summary` | No |
| `enrich` | `context` | `enriched_context` | No |

**Recommended windows:** `24h`, `7d`, `30d`
**Use cases:** seasonality analysis, trend cycle detection, recurring incidents, demand rhythm

---

## 7. Integration Points

| Product | Integration | Description |
|---------|-------------|-------------|
| **GeoFleetic** (`&space`) | Spatial complement | "When AND where." TickTickClock provides temporal context; GeoFleetic provides spatial context. Composed via `&time.anomaly \|> &space.fleet` for spatiotemporal incident detection. |
| **Graphonomous** (`&memory`) | Temporal patterns persisted | Detected patterns, anomalies, and forecast accuracy are stored as nodes/edges in the Graphonomous knowledge graph. Long-term temporal memory lives in Graphonomous; TickTickClock provides the inference. |
| **Deliberatic** (`&reason`) | Temporal disputes | When two agents disagree about a forecast or anomaly classification, Deliberatic resolves the dispute via structured argumentation. TickTickClock provides temporal evidence as arguments. |
| **Delegatic** | Time-based policies | Deadline enforcement, SLA monitoring, time-window access policies. Delegatic references TickTickClock forecasts to pre-authorize capacity scaling before predicted demand spikes. |
| **FleetPrompt** | Temporal agents | Anomaly detection, forecasting, and pattern analysis agents published to the FleetPrompt marketplace. Each wraps TickTickClock MCP tools. |
| **WebHost.Systems** | Hosting | WebHost.Systems hosts TickTickClock MCP servers. Convex backend stores user stream configurations and subscription state. |
| **Agentelic** | Agent builder | Agentelic agents can include `&time.*` capabilities in their specs. The build pipeline validates against TickTickClock's contracts. |
| **SpecPrompt** | Spec standard | TickTickClock capability contracts follow the SpecPrompt specification format. |

---

## 8. MCP Tools

All tools are exposed via `hermes_mcp` and follow the MCP tool calling convention.

### 8.1 Anomaly Tools

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `anomaly_detect` | Detect anomalies from stream or historical data | `{stream_id, data?, window?}` | `{anomalies: [...], stream_id, window}` |
| `anomaly_subscribe` | Subscribe to real-time anomaly events on a stream | `{stream_id, threshold?}` | `{subscription_id, stream_id}` (then async events via PubSub) |

### 8.2 Forecast Tools

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `forecast_predict` | Generate forecast over requested horizon | `{context_id, horizon, data?}` | `{values, timestamps, confidence_lower, confidence_upper}` |
| `forecast_explain` | Explain forecast drivers and confidence | `{forecast_id}` | `{drivers: [...], confidence, contributing_timescales}` |

### 8.3 Pattern Tools

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `pattern_detect` | Detect recurring temporal structures | `{context_id, data, window}` | `{seasonality, trend_cycles, motifs, recurrences}` |
| `pattern_summarize` | Interpretable summary of detected patterns | `{pattern_set}` | `{dominant_period, trend_direction, recurring_count, narrative}` |

### 8.4 Cross-Cutting Tools

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `temporal_enrich` | Attach temporal context to upstream artifacts | `{context, stream_ids?, capabilities?}` | `{enriched_context}` with anomaly, forecast, and pattern annotations |
| `temporal_learn` | Incorporate outcome feedback to improve models | `{observation, stream_id, outcome}` | `{ack, updated_timescales}` |

### 8.5 MCP Tool Implementation

```elixir
defmodule TickTickClock.MCP.Tools do
  @moduledoc "MCP tool definitions for TickTickClock temporal intelligence."

  def tool_definitions do
    [
      %{
        name: "anomaly_detect",
        description: "Detect anomalies from stream or historical time-series data.",
        input_schema: %{
          type: "object",
          properties: %{
            stream_id: %{type: "string", description: "Stream identifier (e.g., cpu:host-01)"},
            data: %{type: "array", items: %{type: "number"}, description: "Optional historical data array"},
            window: %{type: "string", enum: ["1h", "6h", "24h"], description: "Detection window"}
          },
          required: ["stream_id"]
        }
      },
      %{
        name: "anomaly_subscribe",
        description: "Subscribe to real-time anomaly events on a stream.",
        input_schema: %{
          type: "object",
          properties: %{
            stream_id: %{type: "string"},
            threshold: %{type: "number", description: "Custom anomaly score threshold (optional)"}
          },
          required: ["stream_id"]
        }
      },
      %{
        name: "forecast_predict",
        description: "Generate a forecast over the requested horizon.",
        input_schema: %{
          type: "object",
          properties: %{
            context_id: %{type: "string", description: "Forecast context identifier"},
            horizon: %{type: "string", enum: ["1h", "24h", "7d"]},
            data: %{type: "array", items: %{type: "number"}, description: "Optional seed data"}
          },
          required: ["context_id", "horizon"]
        }
      },
      %{
        name: "forecast_explain",
        description: "Explain forecast drivers, confidence, and contributing signals.",
        input_schema: %{
          type: "object",
          properties: %{
            forecast_id: %{type: "string"}
          },
          required: ["forecast_id"]
        }
      },
      %{
        name: "pattern_detect",
        description: "Detect recurring temporal structures (cycles, seasonality, motifs).",
        input_schema: %{
          type: "object",
          properties: %{
            context_id: %{type: "string"},
            data: %{type: "array", items: %{type: "number"}},
            window: %{type: "string", enum: ["24h", "7d", "30d"]}
          },
          required: ["context_id", "data", "window"]
        }
      },
      %{
        name: "pattern_summarize",
        description: "Generate interpretable summary of detected patterns.",
        input_schema: %{
          type: "object",
          properties: %{
            pattern_set: %{type: "object", description: "Output from pattern_detect"}
          },
          required: ["pattern_set"]
        }
      },
      %{
        name: "temporal_enrich",
        description: "Attach temporal context (anomalies, forecasts, patterns) to upstream artifacts.",
        input_schema: %{
          type: "object",
          properties: %{
            context: %{type: "object", description: "Upstream context to enrich"},
            stream_ids: %{type: "array", items: %{type: "string"}},
            capabilities: %{type: "array", items: %{type: "string", enum: ["anomaly", "forecast", "pattern"]}}
          },
          required: ["context"]
        }
      },
      %{
        name: "temporal_learn",
        description: "Incorporate outcome feedback to improve temporal models.",
        input_schema: %{
          type: "object",
          properties: %{
            stream_id: %{type: "string"},
            observation: %{type: "object", description: "Observed outcome"},
            outcome: %{type: "string", enum: ["confirmed", "false_positive", "missed"]}
          },
          required: ["stream_id", "observation", "outcome"]
        }
      }
    ]
  end
end
```

---

## 9. Data Model (Ecto Schemas)

### 9.1 Streams

```elixir
defmodule TickTickClock.Streams.Stream do
  use Ecto.Schema

  schema "streams" do
    field :stream_id, :string        # e.g., "cpu:host-01"
    field :source, :string           # e.g., "prometheus", "custom"
    field :metric_type, :string      # e.g., "gauge", "counter", "histogram"
    field :status, Ecto.Enum, values: [:active, :paused, :archived]
    field :metadata, :map, default: %{}
    field :tick_count, :integer, default: 0
    field :last_tick_at, :utc_datetime_usec

    has_many :anomalies, TickTickClock.Anomalies.Anomaly
    has_many :forecasts, TickTickClock.Forecasts.Forecast

    timestamps()
  end
end
```

### 9.2 Anomalies

```elixir
defmodule TickTickClock.Anomalies.Anomaly do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}

  schema "anomalies" do
    belongs_to :stream, TickTickClock.Streams.Stream

    field :timestamp, :utc_datetime_usec
    field :value, :float
    field :predicted, :float
    field :score, :float
    field :threshold, :float
    field :outcome, Ecto.Enum, values: [:unreviewed, :confirmed, :false_positive]
    field :metadata, :map, default: %{}

    timestamps(updated_at: false)  # append-only
  end
end
```

### 9.3 Forecasts

```elixir
defmodule TickTickClock.Forecasts.Forecast do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}

  schema "forecasts" do
    belongs_to :stream, TickTickClock.Streams.Stream

    field :horizon, :string               # "1h", "24h", "7d"
    field :values, {:array, :float}
    field :timestamps, {:array, :utc_datetime_usec}
    field :confidence_lower, {:array, :float}
    field :confidence_upper, {:array, :float}
    field :contributing_timescales, :map   # %{fast: 0.6, medium: 0.3, ...}
    field :accuracy, :float               # filled in by temporal_learn

    timestamps()
  end
end
```

### 9.4 Patterns

```elixir
defmodule TickTickClock.Patterns.Pattern do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}

  schema "patterns" do
    belongs_to :stream, TickTickClock.Streams.Stream

    field :window, :string                # "24h", "7d", "30d"
    field :pattern_type, Ecto.Enum, values: [:seasonality, :trend_cycle, :motif, :recurrence]
    field :dominant_period, :float        # seconds
    field :confidence, :float
    field :details, :map                  # type-specific structure
    field :first_detected_at, :utc_datetime_usec
    field :last_seen_at, :utc_datetime_usec
    field :occurrence_count, :integer, default: 1

    timestamps()
  end
end
```

### 9.5 TimescaleDB Hypertable Setup

```sql
-- Streams table is standard PostgreSQL
-- Time-series data uses TimescaleDB hypertables

CREATE TABLE stream_ticks (
    stream_id   TEXT NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    metadata    JSONB DEFAULT '{}'
);
SELECT create_hypertable('stream_ticks', 'timestamp');

-- Continuous aggregates for medium/slow/glacial tiers
CREATE MATERIALIZED VIEW hourly_aggregates
WITH (timescaledb.continuous) AS
SELECT
    stream_id,
    time_bucket('1 hour', timestamp) AS bucket,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    stddev(value) AS stddev_value,
    count(*) AS tick_count
FROM stream_ticks
GROUP BY stream_id, bucket;

CREATE MATERIALIZED VIEW daily_aggregates
WITH (timescaledb.continuous) AS
SELECT
    stream_id,
    time_bucket('1 day', timestamp) AS bucket,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    stddev(value) AS stddev_value,
    count(*) AS tick_count
FROM stream_ticks
GROUP BY stream_id, bucket;

-- Compression policy: compress chunks older than 7 days
SELECT add_compression_policy('stream_ticks', INTERVAL '7 days');
```

---

## 10. Performance Targets

| Metric | Target |
|--------|--------|
| Anomaly detection latency (per tick) | < 1ms p99 |
| Forecast generation (single horizon) | < 50ms p99 |
| Pattern detection (7d window) | < 200ms p99 |
| Stream sync precision (cross-node) | < 10ms |
| Concurrent streams (single BEAM node) | 100,000+ |
| Memory promotion (fast → medium) | < 5ms |
| CRDT delta merge | < 1ms |
| ETS hot-cache lookup | < 1us p99 |
| Temporal forgetting | Zero (by design) |

---

## 11. Research Foundations

| Foundation | Application in TickTickClock | Reference |
|-----------|------------------------------|-----------|
| **Selective State-Space Models (Mamba)** | Anomaly engine uses input-dependent selective gating for linear-time sequence processing. Captures short and long-range temporal dependencies without quadratic attention cost. | Gu & Dao, "Mamba: Linear-Time Sequence Modeling with Selective State Spaces," 2023 |
| **Delta-CRDT Replication** | CRDT replication layer uses ACI merge functions and epoch-aware delta exchange. Guarantees eventual consistency under arbitrary network conditions. | Almeida et al., "Delta State Replicated Data Types," J. Parallel Distrib. Comput., 2018; GeoCoCo 2025 |
| **Multi-Timescale Consolidation** | Forecast engine uses nested learning with memory modules at different update frequencies. Fast memory promotes to slow memory. Prevents catastrophic forgetting by isolating timescale dynamics. | "Nested Learning," NeurIPS 2025; Titans architecture |
| **Matrix Profile** | Pattern engine uses Matrix Profile for motif discovery and discord detection in time-series subsequences. | Yeh et al., "Matrix Profile I: All Pairs Similarity Joins for Time Series," ICDM 2016 |
| **MCP-First API Design** | All capabilities exposed as MCP tools via Hermes. No proprietary API layer. | Model Context Protocol Specification |

---

## 12. Implementation Roadmap

### Pre-Phase: Feasibility Validation (Weeks 0–2)

Before committing to the full implementation, validate the three highest-risk technical assumptions:

**FV-1: Selective state-space model (Mamba) on Nx without EXLA**
- [ ] Load a pre-trained Mamba-style SSM via `Bumblebee` + ONNX runtime (no EXLA — consistent with portfolio EXLA exclusion)
- [ ] Run inference on a synthetic time-series stream (1000 ticks, 4 features)
- [ ] Measure per-tick inference latency and memory footprint
- **Pass criteria:** Per-tick inference <50ms on commodity hardware; RSS <500MB for a single stream model
- **Fallback:** If Mamba ONNX models are unavailable or too slow, evaluate a simpler adaptive threshold model (EMA + Z-score) as the MVP anomaly detector, with SSM as a Phase 2 upgrade

**FV-2: Multi-timescale consolidation as GenServer ticking**
- [ ] Prototype four GenServers ticking at different intervals (1s, 1min, 1h, 1d simulated)
- [ ] Feed synthetic anomaly events through the fast tier and verify promotion to medium/slow tiers
- [ ] Measure memory pressure under sustained high-throughput input (10K events/sec)
- **Pass criteria:** Promotion pipeline completes without message queue backlog >1000; ETS fast-memory ring buffer stays within 100MB for 100 concurrent streams

**FV-3: Delta-CRDT convergence for temporal state**
- [ ] Prototype epoch-aware delta-CRDTs for anomaly state (same CRDT approach as GeoFleetic)
- [ ] Simulate 5-node cluster with network partitions during active anomaly detection
- [ ] Verify that anomaly history converges correctly after partition heal
- **Pass criteria:** 100% eventual consistency; no phantom anomalies or lost detections

**FV-4: SQLite-first for MVP (defer TimescaleDB)**
- [ ] Evaluate whether SQLite (via `exqlite`) can serve as the sole storage layer for Phase 0 and Phase 1
- [ ] Prototype medium-tier aggregation queries on SQLite with 1M rows
- **Pass criteria:** Aggregation queries <100ms for daily summaries; if not, TimescaleDB is required from Phase 0

### Acceptance Test Criteria

**Anomaly Engine:**
- Given a stream with a 3σ spike → `anomaly_detect` returns anomaly with `anomaly_score > threshold` within 50ms
- Given a stream with no anomalies → false positive rate < 5% over 10K ticks
- Given a new stream → SSM hidden state initializes correctly; first anomaly detection within 10 ticks
- Given `anomaly_subscribe` → PubSub delivers anomaly events to subscriber within 100ms of detection

**Forecast Engine:**
- Given a stream with 1000 historical ticks → `forecast_predict` returns prediction with confidence interval within 500ms
- Given a forecast + actual outcome → `temporal_learn` updates confidence and model weights
- Given multi-timescale memory → fast (1s) events promote to medium (1min) tier correctly; no data loss during promotion
- Given `forecast_explain` → response includes human-readable temporal factors (trend, seasonality, recent anomalies)

**Pattern Engine:**
- Given a stream with daily seasonality → `pattern_detect` identifies the 24h cycle within 48h of data
- Given a stream with a known motif → motif discovery via Matrix Profile finds the pattern with > 80% recall
- Given `pattern_summarize` → returns structured summary with detected frequencies, trends, and confidence scores

**Delta-CRDTs:**
- Given 5 nodes with divergent anomaly state after partition → states converge within 5s of partition heal
- Given concurrent anomaly detections on 2 nodes → delta merge produces correct final anomaly history (no phantom anomalies, no lost detections)

**`&govern` Integration:**

TickTickClock emits telemetry via `&govern.telemetry.emit`:
- `anomaly.detected` — anomaly events with stream_id, score, threshold
- `forecast.generated` — forecast computation with horizon, confidence, compute duration
- `pattern.detected` — pattern discovery events with frequency, significance
- `stream.created` / `stream.removed` — lifecycle events for capacity tracking

When anomaly detection compute exceeds `max_compute_ms_per_task` (from Delegatic policy), TickTickClock falls back to the EMA+Z-score fast path and emits `&govern.telemetry.emit` with `status: "degraded"`. If a forecast confidence falls below `escalate_when.confidence_below`, it escalates via `&govern.escalation.escalate`.

### Phase 0: Foundation (Weeks 3–6)
- [ ] Mix project scaffold (`tick_tick_clock`)
- [ ] Ecto schemas + migrations (streams, anomalies, forecasts, patterns)
- [ ] TimescaleDB hypertable setup + continuous aggregates (or SQLite-first per FV-4 outcome)
- [ ] StreamManager DynamicSupervisor + per-stream GenServer
- [ ] ETS-backed fast memory ring buffers
- [ ] Basic tick ingestion pipeline (Broadway)

### Phase 1: Anomaly Engine (Weeks 5–8)
- [ ] SSM model loading via Bumblebee/ONNX
- [ ] Selective state update + adaptive gating
- [ ] Dynamic threshold computation (EMA)
- [ ] Anomaly event broadcast via Phoenix PubSub
- [ ] MCP tools: `anomaly_detect`, `anomaly_subscribe`
- [ ] Hermes MCP server integration

### Phase 2: Forecast Engine (Weeks 9–12)
- [ ] Multi-timescale memory store (fast/medium/slow/glacial GenServers)
- [ ] Memory promotion pipeline (Consolidator)
- [ ] CCO prediction: compose across timescales
- [ ] Confidence interval computation
- [ ] MCP tools: `forecast_predict`, `forecast_explain`
- [ ] Outcome feedback via `temporal_learn`

### Phase 3: Pattern Engine (Weeks 13–16)
- [ ] Spectral decomposition (FFT via Nx)
- [ ] Autocorrelation function computation
- [ ] Matrix Profile motif discovery
- [ ] Recurrence detection against known patterns
- [ ] MCP tools: `pattern_detect`, `pattern_summarize`
- [ ] `temporal_enrich` cross-cutting tool

### Phase 4: Replication & Edge (Weeks 17–22)
- [ ] Delta-CRDT replication module
- [ ] ACI merge functions for each state type
- [ ] Epoch tracking + delta exchange protocol
- [ ] `libcluster` node discovery
- [ ] SQLite backend for edge deployments
- [ ] Bumblebee model quantization for constrained devices

### Phase 5: Integration & Enterprise (Weeks 23–30)
- [ ] Phoenix LiveView dashboard (stream, anomaly, forecast, pattern views)
- [ ] GeoFleetic integration (`&time \|> &space` composition)
- [ ] Graphonomous integration (persist patterns as knowledge graph nodes)
- [ ] Deliberatic integration (temporal evidence for dispute resolution)
- [ ] SSO/SAML, multi-tenant stream isolation
- [ ] Prometheus telemetry export

---

## 13. Pricing

| Tier | Price | Streams | Features |
|------|-------|---------|----------|
| **Developer** | Free | 5 streams | Anomaly detection, 1h forecasts, 24h patterns. Single node. Community support. |
| **Team** | $99/mo | 100 streams | All capabilities. All horizons/windows. 3 nodes. CRDT replication. Email support. |
| **Business** | $499/mo | 1,000 streams | Everything in Team + TimescaleDB, Phoenix dashboard, Graphonomous integration, priority support. |
| **Enterprise** | Custom | Unlimited | Dedicated infra, SSO/SAML, SLA, multi-region CRDT clusters, white-glove onboarding. |

---

## 14. ADR Summary

### ADR-0001: GenServer-Per-Stream
Each monitored stream is an independent GenServer process. Streams share no state. Fault isolation is automatic — a crash in one stream's anomaly detector does not affect others. The BEAM scheduler handles 100K+ lightweight processes.

### ADR-0002: Multi-Timescale Memory as Separate GenServers
Each timescale (fast/medium/slow/glacial) is a separate supervised GenServer with its own tick interval. This mirrors the Nested Learning architecture and prevents fast-frequency noise from corrupting slow-frequency models. Promotion between timescales is explicit and auditable.

### ADR-0003: ETS for Fast Memory, DB for Everything Else
Fast memory (sub-second) lives in ETS ring buffers for sub-microsecond access. Medium through glacial tiers live in TimescaleDB (server) or SQLite (edge). The boundary is configurable via application config. DETS serves as a spill target when ETS memory pressure exceeds threshold.

### ADR-0004: Epoch-Aware Delta-CRDTs over Raft
TickTickClock chose delta-CRDTs over Raft consensus because temporal intelligence tolerates brief inconsistency (two nodes may disagree on a threshold for milliseconds) but cannot tolerate unavailability (a partitioned node must continue detecting anomalies). AP over CP. Epoch tracking prevents stale delta application.

### ADR-0005: No EXLA Dependency
Consistent with the portfolio convention. Nx computations use binary backend or ONNX runtime via Bumblebee. Avoids NIF/CUDA compilation issues on edge devices and CI environments.

---

*TickTickClock: Every tick is a learning opportunity. Every pattern has a rhythm.*
