# TickTickClock Phase 3: Advanced Features & Optimization

## Overview
This phase adds advanced communication patterns, comprehensive telemetry, performance optimization, and real-world examples. It makes TickTickClock production-ready.

## Goals
- Implement advanced communication patterns (broadcast, scatter-gather, reduce)
- Add comprehensive telemetry and metrics
- Performance optimization and profiling
- Implement BSP cost model analysis
- Create real-world example applications
- Add benchmarking infrastructure

## Modules to Implement

### 1. TickTickClock.Communication

**Location**: `lib/tick_tick_clock/communication.ex`

```elixir
defmodule TickTickClock.Communication do
  @moduledoc """
  Advanced communication patterns for BSP.

  Provides common patterns:
  - Broadcast: One-to-all
  - Scatter: Distribute data across processors
  - Gather: Collect data from all processors
  - AllGather: Everyone gets everything
  - Reduce: Aggregate with operation (sum, max, min, etc.)
  - AllReduce: Reduce + broadcast result
  - AllToAll: Every processor sends to every other
  """

  @doc """
  Broadcasts value from root processor to all others.

  ## Example

      broadcast(state, root: 0, value: state.data)
  """
  def broadcast(state, opts) do
    root = Keyword.fetch!(opts, :root)
    value = Keyword.fetch!(opts, :value)
    num_processors = Map.get(state, :num_processors, System.schedulers_online())

    if state.processor_id == root do
      # Root sends to everyone
      Enum.map(0..(num_processors - 1), fn pid ->
        {pid, {:broadcast, value}}
      end)
    else
      # Others send nothing
      []
    end
  end

  @doc """
  Scatters data from root to all processors.

  ## Example

      scatter(state, root: 0, data: chunks)
  """
  def scatter(state, opts) do
    root = Keyword.fetch!(opts, :root)
    data_chunks = Keyword.fetch!(opts, :data)

    if state.processor_id == root do
      Enum.with_index(data_chunks)
      |> Enum.map(fn {chunk, pid} -> {pid, {:scatter, chunk}} end)
    else
      []
    end
  end

  @doc """
  Gathers data from all processors to root.

  ## Example

      gather(state, root: 0, value: state.local_result)
  """
  def gather(state, opts) do
    root = Keyword.fetch!(opts, :root)
    value = Keyword.fetch!(opts, :value)

    [{root, {:gather, state.processor_id, value}}]
  end

  @doc """
  All-gather: Every processor gets data from all others.

  ## Example

      all_gather(state, value: state.local_sum)
  """
  def all_gather(state, opts) do
    value = Keyword.fetch!(opts, :value)
    num_processors = Map.get(state, :num_processors, System.schedulers_online())

    Enum.map(0..(num_processors - 1), fn pid ->
      {pid, {:all_gather, state.processor_id, value}}
    end)
  end

  @doc """
  Reduce: Aggregate values with operation.

  ## Example

      reduce(state, root: 0, value: state.local_sum, op: :sum)
  """
  def reduce(state, opts) do
    root = Keyword.fetch!(opts, :root)
    value = Keyword.fetch!(opts, :value)
    op = Keyword.get(opts, :op, :sum)

    [{root, {:reduce, state.processor_id, value, op}}]
  end

  @doc """
  All-reduce: Reduce and broadcast result to all.

  ## Example

      all_reduce(state, value: state.local_max, op: :max)
  """
  def all_reduce(state, opts) do
    value = Keyword.fetch!(opts, :value)
    op = Keyword.get(opts, :op, :sum)
    num_processors = Map.get(state, :num_processors, System.schedulers_online())

    Enum.map(0..(num_processors - 1), fn pid ->
      {pid, {:all_reduce, state.processor_id, value, op}}
    end)
  end

  @doc """
  All-to-all: Personalized exchange between all processors.

  ## Example

      all_to_all(state, messages: messages_per_processor)
  """
  def all_to_all(state, opts) do
    messages = Keyword.fetch!(opts, :messages)

    Enum.map(messages, fn {pid, msg} ->
      {pid, {:all_to_all, state.processor_id, msg}}
    end)
  end

  @doc """
  Applies reduce operation to list of values.
  """
  def apply_reduce(values, :sum), do: Enum.sum(values)
  def apply_reduce(values, :product), do: Enum.reduce(values, 1, &*/2)
  def apply_reduce(values, :max), do: Enum.max(values)
  def apply_reduce(values, :min), do: Enum.min(values)
  def apply_reduce(values, :count), do: length(values)
  def apply_reduce(values, :avg), do: Enum.sum(values) / length(values)

  def apply_reduce(values, {:custom, fun}) when is_function(fun, 2) do
    Enum.reduce(values, fun)
  end
end
```

### 2. TickTickClock.Telemetry

**Location**: `lib/tick_tick_clock/telemetry.ex`

```elixir
defmodule TickTickClock.Telemetry do
  @moduledoc """
  Telemetry instrumentation and metrics for TickTickClock.

  Events:
  - [:tick_tick_clock, :coordinator, :initialized]
  - [:tick_tick_clock, :coordinator, :computation_completed]
  - [:tick_tick_clock, :coordinator, :superstep_completed]
  - [:tick_tick_clock, :processor, :initialized]
  - [:tick_tick_clock, :processor, :compute_completed]
  - [:tick_tick_clock, :processor, :communicate_completed]
  - [:tick_tick_clock, :processor, :barrier_reached]
  """

  import Telemetry.Metrics

  @doc """
  Returns list of telemetry metrics for monitoring.
  """
  def metrics do
    [
      # Coordinator metrics
      counter("tick_tick_clock.coordinator.initialized.count"),
      counter("tick_tick_clock.coordinator.computation_completed.count"),
      
      distribution("tick_tick_clock.coordinator.computation_completed.duration",
        unit: {:native, :millisecond},
        tags: [:computation_module]
      ),

      summary("tick_tick_clock.coordinator.superstep_completed.duration",
        unit: {:native, :millisecond},
        tags: [:superstep]
      ),

      # Processor metrics
      counter("tick_tick_clock.processor.initialized.count"),
      
      distribution("tick_tick_clock.processor.compute_completed.duration",
        unit: {:native, :millisecond},
        tags: [:processor_id, :superstep]
      ),

      summary("tick_tick_clock.processor.communicate_completed.duration",
        unit: {:native, :millisecond},
        tags: [:processor_id]
      ),

      last_value("tick_tick_clock.processor.inbox_size",
        tags: [:processor_id]
      ),

      last_value("tick_tick_clock.processor.message_count",
        tags: [:processor_id]
      ),

      # Barrier metrics
      counter("tick_tick_clock.processor.barrier_reached.count",
        tags: [:processor_id]
      )
    ]
  end

  @doc """
  Attaches telemetry handlers for logging.
  """
  def attach_logger_handler do
    events = [
      [:tick_tick_clock, :coordinator, :computation_completed],
      [:tick_tick_clock, :coordinator, :superstep_completed],
      [:tick_tick_clock, :processor, :compute_error],
      [:tick_tick_clock, :processor, :communicate_error]
    ]

    :telemetry.attach_many(
      "tick-tick-clock-logger",
      events,
      &handle_event/4,
      nil
    )
  end

  defp handle_event([:tick_tick_clock, :coordinator, :computation_completed], measurements, metadata, _config) do
    require Logger
    duration_ms = System.convert_time_unit(measurements.duration, :native, :millisecond)
    
    Logger.info("BSP computation completed in #{duration_ms}ms, #{metadata.superstep_count} supersteps")
  end

  defp handle_event([:tick_tick_clock, :coordinator, :superstep_completed], measurements, metadata, _config) do
    require Logger
    duration_ms = System.convert_time_unit(measurements.duration, :native, :millisecond)
    
    Logger.debug("Superstep #{metadata.superstep} completed in #{duration_ms}ms, converged: #{metadata.converged}")
  end

  defp handle_event([:tick_tick_clock, :processor, event], _measurements, metadata, _config) 
       when event in [:compute_error, :communicate_error] do
    require Logger
    Logger.error("Processor #{metadata.processor_id} #{event}: #{inspect(metadata.reason)}")
  end

  defp handle_event(_event, _measurements, _metadata, _config), do: :ok
end
```

### 3. TickTickClock.CostModel

**Location**: `lib/tick_tick_clock/cost_model.ex`

```elixir
defmodule TickTickClock.CostModel do
  @moduledoc """
  BSP cost model analysis: T = w + h·g + l

  Where:
  - w: Maximum local computation time
  - h: Maximum messages sent/received (h-relation)
  - g: Communication gap (bandwidth parameter)
  - l: Barrier synchronization latency
  """

  @type params :: %{
    processors: pos_integer(),
    g: float(),  # Gap parameter
    l: float()   # Latency parameter
  }

  @doc """
  Predicts superstep execution time.

  ## Example

      predict_superstep_time(
        work: 1000,        # flops
        h_relation: 100,   # max messages
        params: %{g: 10.0, l: 50.0}
      )
  """
  def predict_superstep_time(opts) do
    w = Keyword.fetch!(opts, :work)
    h = Keyword.fetch!(opts, :h_relation)
    params = Keyword.fetch!(opts, :params)

    w + h * params.g + params.l
  end

  @doc """
  Analyzes actual vs predicted performance.
  """
  def analyze_performance(actual_duration, predicted_duration) do
    error = abs(actual_duration - predicted_duration)
    error_percent = (error / predicted_duration) * 100

    %{
      actual: actual_duration,
      predicted: predicted_duration,
      error: error,
      error_percent: error_percent,
      accurate?: error_percent < 20.0
    }
  end

  @doc """
  Estimates BSP parameters (g, l) from profiling data.
  """
  def estimate_parameters(profiling_data) do
    # Linear regression to find g and l
    # T = w + h*g + l
    
    # Simplified estimation
    avg_comm_cost = profiling_data
    |> Enum.map(& &1.comm_time / &1.h_relation)
    |> Enum.sum()
    |> Kernel./(length(profiling_data))

    avg_barrier_cost = profiling_data
    |> Enum.map(& &1.barrier_time)
    |> Enum.sum()
    |> Kernel./(length(profiling_data))

    %{g: avg_comm_cost, l: avg_barrier_cost}
  end

  @doc """
  Calculates efficiency: speedup / num_processors
  """
  def efficiency(sequential_time, parallel_time, num_processors) do
    speedup = sequential_time / parallel_time
    speedup / num_processors
  end

  @doc """
  Calculates scalability: how speedup changes with processors
  """
  def scalability(data_points) do
    # data_points: [{num_processors, speedup}]
    
    # Check if speedup increases linearly
    Enum.chunk_every(data_points, 2, 1, :discard)
    |> Enum.map(fn [{p1, s1}, {p2, s2}] ->
      expected_speedup = s1 * (p2 / p1)
      actual_speedup = s2
      actual_speedup / expected_speedup
    end)
    |> Enum.sum()
    |> Kernel./(length(data_points) - 1)
  end
end
```

### 4. Real-World Examples

#### examples/pagerank.exs

```elixir
defmodule PageRank do
  @moduledoc """
  Google PageRank algorithm using BSP.
  
  Computes importance of nodes in a graph based on incoming links.
  """
  use TickTickClock.BSP

  alias TickTickClock.Communication

  @damping_factor 0.85
  @convergence_threshold 0.0001

  def initialize(graph, processor_id) do
    num_nodes = graph.num_nodes
    initial_rank = 1.0 / num_nodes

    # Partition nodes to this processor
    nodes = partition_nodes(graph.nodes, processor_id)

    state = %{
      processor_id: processor_id,
      num_processors: graph.num_processors,
      nodes: nodes,
      num_nodes: num_nodes,
      ranks: init_ranks(nodes, initial_rank)
    }

    {:ok, state}
  end

  superstep :calculate_pagerank do
    compute fn state ->
      # Calculate new ranks from received contributions
      new_ranks = Map.new(state.ranks, fn {node_id, _rank} ->
        contributions = Enum.filter(state.inbox, fn {id, _} -> id == node_id end)
        
        contribution_sum = contributions
        |> Enum.map(fn {_, contrib} -> contrib end)
        |> Enum.sum()

        new_rank = (1 - @damping_factor) / state.num_nodes + 
                   @damping_factor * contribution_sum

        {node_id, new_rank}
      end)

      {:ok, %{state | ranks: new_ranks}}
    end

    communicate do
      send_to :neighbors, fn state ->
        # Send rank contributions to neighbors
        Enum.flat_map(state.nodes, fn node ->
          outgoing = length(node.edges)
          contribution = state.ranks[node.id] / outgoing

          Enum.map(node.edges, fn neighbor_id ->
            {neighbor_processor_id(neighbor_id, state), {neighbor_id, contribution}}
          end)
        end)
      end
    end

    converged? fn old_state, new_state ->
      # Check if ranks have converged
      max_diff = Enum.map(old_state.ranks, fn {node_id, old_rank} ->
        new_rank = new_state.ranks[node_id]
        abs(new_rank - old_rank)
      end)
      |> Enum.max()

      max_diff < @convergence_threshold
    end
  end

  defp partition_nodes(nodes, processor_id) do
    Enum.filter(nodes, fn node ->
      rem(node.id, System.schedulers_online()) == processor_id
    end)
  end

  defp init_ranks(nodes, initial_rank) do
    Map.new(nodes, fn node -> {node.id, initial_rank} end)
  end

  defp neighbor_processor_id(node_id, state) do
    rem(node_id, state.num_processors)
  end
end
```

#### examples/distributed_sort.exs

```elixir
defmodule DistributedSort do
  @moduledoc """
  Parallel sample sort algorithm using BSP.
  """
  use TickTickClock.BSP

  alias TickTickClock.Communication

  def initialize(data, processor_id) do
    {:ok, %{
      processor_id: processor_id,
      data: data,
      samples: [],
      buckets: [],
      sorted: []
    }}
  end

  superstep :sample_phase do
    compute fn state ->
      # Select random samples
      num_samples = min(100, length(state.data))
      samples = Enum.take_random(state.data, num_samples)
      {:ok, %{state | samples: samples}}
    end

    communicate do
      send_to :all, fn state ->
        # Send samples to processor 0 for pivot selection
        [{0, {:samples, state.samples}}]
      end
    end
  end

  superstep :pivot_phase do
    compute fn state ->
      if state.processor_id == 0 do
        # Collect all samples and choose pivots
        all_samples = Enum.flat_map(state.inbox, fn {:samples, s} -> s end)
        sorted_samples = Enum.sort(all_samples)
        pivots = select_pivots(sorted_samples, state.num_processors)
        {:ok, %{state | pivots: pivots}}
      else
        {:ok, state}
      end
    end

    communicate do
      send_to :all, fn state ->
        if state.processor_id == 0 do
          # Broadcast pivots to all
          Communication.broadcast(state, root: 0, value: state.pivots)
        else
          []
        end
      end
    end
  end

  superstep :partition_phase do
    compute fn state ->
      pivots = extract_broadcast(state.inbox)
      buckets = partition_data(state.data, pivots)
      {:ok, %{state | buckets: buckets}}
    end

    communicate do
      send_to :specific, fn state ->
        # Send buckets to appropriate processors
        Enum.with_index(state.buckets)
        |> Enum.flat_map(fn {bucket, processor_id} ->
          Enum.map(bucket, fn elem -> {processor_id, elem} end)
        end)
      end
    end
  end

  superstep :local_sort do
    compute fn state ->
      received_data = state.inbox
      sorted = Enum.sort(state.data ++ received_data)
      {:ok, %{state | sorted: sorted}}
    end

    converged? fn _, _ -> true end
  end

  defp select_pivots(sorted_samples, num_processors) do
    step = div(length(sorted_samples), num_processors)
    Enum.take_every(sorted_samples, step)
    |> Enum.take(num_processors - 1)
  end

  defp partition_data(data, pivots) do
    Enum.group_by(data, fn elem ->
      Enum.find_index(pivots, fn pivot -> elem <= pivot end) || length(pivots)
    end)
    |> Enum.sort_by(fn {idx, _} -> idx end)
    |> Enum.map(fn {_, bucket} -> bucket end)
  end

  defp extract_broadcast(inbox) do
    case Enum.find(inbox, fn msg -> match?({:broadcast, _}, msg) end) do
      {:broadcast, value} -> value
      _ -> []
    end
  end
end
```

### 5. Benchmarking

#### benchmarks/bsp_benchmark.exs

```elixir
defmodule BSPBenchmark do
  @moduledoc """
  Comprehensive benchmarks for TickTickClock.
  """

  alias TickTickClock.CostModel

  def run do
    Benchee.run(
      %{
        "simple_computation" => fn ->
          run_simple_computation()
        end,
        "pagerank_small" => fn ->
          run_pagerank(nodes: 100, edges: 500)
        end,
        "parallel_sum" => fn ->
          run_parallel_sum(1..10_000 |> Enum.to_list())
        end
      },
      time: 10,
      memory_time: 2,
      reduction_time: 2,
      formatters: [
        Benchee.Formatters.Console,
        {Benchee.Formatters.HTML, file: "benchmarks/results/bsp_bench.html"}
      ]
    )
  end

  def scaling_benchmark do
    # Test scaling with different processor counts
    processor_counts = [1, 2, 4, 8, 16]
    
    results = Enum.map(processor_counts, fn num_procs ->
      {time, _result} = :timer.tc(fn ->
        run_pagerank(nodes: 1000, edges: 5000, processors: num_procs)
      end)

      {num_procs, time / 1_000_000}  # Convert to seconds
    end)

    analyze_scaling(results)
  end

  defp run_simple_computation do
    # Implementation
  end

  defp run_pagerank(opts) do
    # Implementation
  end

  defp run_parallel_sum(data) do
    # Implementation
  end

  defp analyze_scaling(results) do
    [{1, baseline_time} | _] = results

    IO.puts("\nScaling Analysis:")
    IO.puts("Processors | Time (s) | Speedup | Efficiency")
    IO.puts("-----------|----------|---------|------------")

    Enum.each(results, fn {procs, time} ->
      speedup = baseline_time / time
      efficiency = CostModel.efficiency(baseline_time, time, procs)

      :io.format("~10w | ~8.2f | ~7.2fx | ~9.1f%\n", 
        [procs, time, speedup, efficiency * 100])
    end)
  end
end

BSPBenchmark.run()
```

## Validation Checklist

- [ ] Communication patterns (broadcast, reduce, etc.) work
- [ ] Telemetry events emitted correctly
- [ ] Cost model predictions reasonable
- [ ] PageRank example converges
- [ ] Distributed sort produces correct results
- [ ] Benchmarks run successfully
- [ ] Performance scales with processors
- [ ] Documentation complete
- [ ] All tests pass

## Next Steps

- **Phase 4**: Stellarmorphism integration
- **Phase 5**: Phoenix LiveView dashboard
- **Phase 6**: OPEN workflow integration
- **Phase 7**: Production deployment guide

## Notes for AI

1. **Communication patterns**: Follow MPI collective operation semantics
2. **Telemetry**: Emit at start and end of operations
3. **Cost model**: Keep it simple, validate with real measurements
4. **Examples**: Make them educational and realistic
5. **Benchmarking**: Use Benchee, save HTML reports
6. **Performance**: Profile before optimizing
7. **Documentation**: Every pattern needs an example