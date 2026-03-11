# TickTickClock Phase 2: Processor & Coordinator Runtime

## Overview
This phase implements the runtime execution engine: the Processor GenServers that execute BSP computations and the Coordinator that orchestrates superstep execution across all processors.

## Goals
- Implement Processor GenServer for parallel execution
- Build Coordinator for superstep orchestration
- Handle message routing between processors
- Implement state management and recovery
- Add telemetry instrumentation

## Architecture

```
Coordinator (GenServer)
    ├── Manages superstep progression
    ├── Tracks processor states
    └── Coordinates barriers

Processor 1 (GenServer) ←→ Message Exchange ←→ Processor 2 (GenServer)
    ↓                                                ↓
  Local State                                   Local State
```

## Core Modules

### 1. TickTickClock.Processor

**Location**: `lib/tick_tick_clock/processor.ex`

```elixir
defmodule TickTickClock.Processor do
  @moduledoc """
  GenServer that executes BSP computation on a partition of data.

  Each processor:
  - Maintains local state
  - Executes compute phase
  - Sends/receives messages
  - Participates in barrier synchronization
  - Reports status to coordinator
  """

  use GenServer
  require Logger
  alias TickTickClock.{Superstep, Types}

  @type t :: %__MODULE__{
    id: Types.processor_id(),
    computation_module: module(),
    state: Types.processor_state(),
    inbox: list(any()),
    outbox: list(Types.message()),
    current_superstep: Types.superstep_name() | nil,
    phase: Types.phase(),
    coordinator_pid: pid(),
    config: map()
  }

  defstruct [
    :id,
    :computation_module,
    :state,
    :coordinator_pid,
    inbox: [],
    outbox: [],
    current_superstep: nil,
    phase: :idle,
    config: %{}
  ]

  ## Client API

  @doc """
  Starts a processor.
  """
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  @doc """
  Initializes processor state with input data.
  """
  def initialize(pid, input_data) do
    GenServer.call(pid, {:initialize, input_data})
  end

  @doc """
  Executes the compute phase of a superstep.
  """
  def compute(pid, superstep_name) do
    GenServer.call(pid, {:compute, superstep_name}, :infinity)
  end

  @doc """
  Executes the communicate phase and returns messages.
  """
  def communicate(pid) do
    GenServer.call(pid, :communicate, :infinity)
  end

  @doc """
  Delivers messages from other processors.
  """
  def deliver_messages(pid, messages) do
    GenServer.cast(pid, {:deliver_messages, messages})
  end

  @doc """
  Signals barrier reached.
  """
  def barrier(pid) do
    GenServer.call(pid, :barrier)
  end

  @doc """
  Gets current processor state.
  """
  def get_state(pid) do
    GenServer.call(pid, :get_state)
  end

  @doc """
  Finalizes computation and returns result.
  """
  def finalize(pid, reason) do
    GenServer.call(pid, {:finalize, reason})
  end

  ## Server Callbacks

  @impl true
  def init(opts) do
    processor_id = Keyword.fetch!(opts, :processor_id)
    computation_module = Keyword.fetch!(opts, :computation_module)
    coordinator_pid = Keyword.fetch!(opts, :coordinator_pid)
    config = Keyword.get(opts, :config, %{})

    state = %__MODULE__{
      id: processor_id,
      computation_module: computation_module,
      coordinator_pid: coordinator_pid,
      config: config,
      phase: :idle
    }

    Logger.debug("Processor #{processor_id} initialized")
    emit_telemetry(:processor_initialized, %{processor_id: processor_id})

    {:ok, state}
  end

  @impl true
  def handle_call({:initialize, input_data}, _from, state) do
    start_time = System.monotonic_time()

    case state.computation_module.initialize(input_data, state.id) do
      {:ok, initial_state} ->
        emit_telemetry(:processor_data_initialized, %{
          processor_id: state.id,
          duration: System.monotonic_time() - start_time
        })

        {:reply, :ok, %{state | state: initial_state, phase: :ready}}

      {:error, reason} = error ->
        Logger.error("Processor #{state.id} initialization failed: #{inspect(reason)}")
        {:reply, error, state}
    end
  end

  @impl true
  def handle_call({:compute, superstep_name}, _from, state) do
    start_time = System.monotonic_time()

    Logger.debug("Processor #{state.id} computing superstep #{superstep_name}")

    case state.computation_module.compute(state.state, state.inbox, superstep_name) do
      {:ok, new_state} ->
        duration = System.monotonic_time() - start_time

        emit_telemetry(:compute_completed, %{
          processor_id: state.id,
          superstep: superstep_name,
          duration: duration,
          inbox_size: length(state.inbox)
        })

        new_processor_state = %{state |
          state: new_state,
          current_superstep: superstep_name,
          phase: :computed,
          inbox: []  # Clear inbox after processing
        }

        {:reply, {:ok, new_state}, new_processor_state}

      {:error, reason} = error ->
        Logger.error("Processor #{state.id} compute error: #{inspect(reason)}")
        
        emit_telemetry(:compute_error, %{
          processor_id: state.id,
          superstep: superstep_name,
          reason: reason
        })

        {:reply, error, state}
    end
  end

  @impl true
  def handle_call(:communicate, _from, state) do
    start_time = System.monotonic_time()

    Logger.debug("Processor #{state.id} communicating")

    case state.computation_module.communicate(state.state, state.current_superstep) do
      {:ok, messages} ->
        duration = System.monotonic_time() - start_time

        emit_telemetry(:communicate_completed, %{
          processor_id: state.id,
          superstep: state.current_superstep,
          duration: duration,
          message_count: length(messages)
        })

        new_state = %{state | outbox: messages, phase: :communicated}
        {:reply, {:ok, messages}, new_state}

      {:error, reason} = error ->
        Logger.error("Processor #{state.id} communicate error: #{inspect(reason)}")
        {:reply, error, state}
    end
  end

  @impl true
  def handle_call(:barrier, _from, state) do
    Logger.debug("Processor #{state.id} reached barrier")
    
    emit_telemetry(:barrier_reached, %{
      processor_id: state.id,
      superstep: state.current_superstep
    })

    new_state = %{state | phase: :barrier, outbox: []}
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, state.state, state}
  end

  @impl true
  def handle_call({:finalize, reason}, _from, state) do
    Logger.info("Processor #{state.id} finalizing: #{reason}")

    case state.computation_module.finalize(state.state, reason) do
      {:ok, result} ->
        emit_telemetry(:processor_finalized, %{
          processor_id: state.id,
          reason: reason
        })

        {:reply, {:ok, result}, %{state | phase: :finalized}}

      {:error, _} = error ->
        {:reply, error, state}
    end
  end

  @impl true
  def handle_cast({:deliver_messages, messages}, state) do
    Logger.debug("Processor #{state.id} received #{length(messages)} messages")

    new_inbox = state.inbox ++ messages
    {:noreply, %{state | inbox: new_inbox, phase: :ready}}
  end

  ## Private Helpers

  defp emit_telemetry(event, measurements, metadata \\ %{}) do
    :telemetry.execute(
      [:tick_tick_clock, :processor, event],
      measurements,
      metadata
    )
  end
end
```

### 2. TickTickClock.Coordinator

**Location**: `lib/tick_tick_clock/coordinator.ex`

```elixir
defmodule TickTickClock.Coordinator do
  @moduledoc """
  Coordinates BSP computation across all processors.

  Responsibilities:
  - Start and initialize processors
  - Orchestrate superstep execution
  - Route messages between processors
  - Manage barrier synchronization
  - Detect convergence
  - Handle failures and recovery
  """

  use GenServer
  require Logger
  alias TickTickClock.{Processor, Barrier, Types}

  @type t :: %__MODULE__{
    computation_module: module(),
    processors: list(pid()),
    processor_states: map(),
    current_superstep: Types.superstep_name(),
    superstep_count: non_neg_integer(),
    max_supersteps: pos_integer(),
    config: Types.config(),
    status: Types.status(),
    barrier: pid() | nil
  }

  defstruct [
    :computation_module,
    :barrier,
    processors: [],
    processor_states: %{},
    current_superstep: nil,
    superstep_count: 0,
    max_supersteps: 1000,
    config: %{},
    status: :initializing
  ]

  ## Client API

  @doc """
  Starts a BSP computation coordinator.
  """
  def start_link(computation_module, input, opts \\ []) do
    GenServer.start_link(__MODULE__, {computation_module, input, opts})
  end

  @doc """
  Runs the BSP computation to completion.
  """
  def run(pid, timeout \\ :infinity) do
    GenServer.call(pid, :run, timeout)
  end

  @doc """
  Gets computation status.
  """
  def status(pid) do
    GenServer.call(pid, :status)
  end

  @doc """
  Stops the computation.
  """
  def stop(pid) do
    GenServer.stop(pid, :normal)
  end

  ## Server Callbacks

  @impl true
  def init({computation_module, input, opts}) do
    config = Types.merge_config(Map.new(opts))
    num_processors = config.processors

    Logger.info("Starting BSP computation: #{computation_module} with #{num_processors} processors")

    # Get supersteps from module
    supersteps = computation_module.__bsp_supersteps__()
    first_superstep = hd(supersteps).name

    # Start barrier
    {:ok, barrier_pid} = Barrier.start_link(num_processors)

    state = %__MODULE__{
      computation_module: computation_module,
      current_superstep: first_superstep,
      max_supersteps: config.max_supersteps,
      config: config,
      barrier: barrier_pid,
      status: :initializing
    }

    # Spawn processors
    processor_pids = spawn_processors(state, input)

    new_state = %{state | processors: processor_pids, status: :ready}

    emit_telemetry(:coordinator_initialized, %{
      computation_module: computation_module,
      num_processors: num_processors
    })

    {:ok, new_state}
  end

  @impl true
  def handle_call(:run, _from, state) do
    Logger.info("Starting BSP execution")
    
    start_time = System.monotonic_time()

    result = execute_computation(state)

    duration = System.monotonic_time() - start_time

    emit_telemetry(:computation_completed, %{
      duration: duration,
      superstep_count: state.superstep_count,
      status: elem(result, 0)
    })

    {:reply, result, state}
  end

  @impl true
  def handle_call(:status, _from, state) do
    status = %{
      status: state.status,
      current_superstep: state.current_superstep,
      superstep_count: state.superstep_count,
      num_processors: length(state.processors)
    }

    {:reply, status, state}
  end

  ## Private Functions

  defp spawn_processors(state, input) do
    num_processors = state.config.processors

    # Partition input data
    partitions = partition_input(input, num_processors)

    # Start processors
    Enum.map(0..(num_processors - 1), fn processor_id ->
      {:ok, pid} = Processor.start_link(
        processor_id: processor_id,
        computation_module: state.computation_module,
        coordinator_pid: self(),
        config: state.config
      )

      # Initialize with partitioned data
      :ok = Processor.initialize(pid, Enum.at(partitions, processor_id))

      pid
    end)
  end

  defp execute_computation(state) do
    supersteps = state.computation_module.__bsp_supersteps__()

    execute_supersteps(state, supersteps, 0)
  end

  defp execute_supersteps(state, _supersteps, iteration) when iteration >= state.max_supersteps do
    Logger.warn("Reached maximum supersteps: #{state.max_supersteps}")
    finalize_computation(state, :max_supersteps)
  end

  defp execute_supersteps(state, supersteps, iteration) do
    # Execute each superstep in sequence
    Enum.reduce_while(supersteps, {:ok, state}, fn superstep, {:ok, current_state} ->
      Logger.info("Executing superstep: #{superstep.name} (iteration #{iteration})")

      case execute_single_superstep(current_state, superstep.name) do
        {:converged, new_state} ->
          Logger.info("Computation converged at superstep #{superstep.name}")
          {:halt, finalize_computation(new_state, :converged)}

        {:continue, new_state} ->
          {:cont, {:ok, %{new_state | superstep_count: new_state.superstep_count + 1}}}

        {:error, _} = error ->
          {:halt, error}
      end
    end)
    |> case do
      {:ok, new_state} ->
        # Loop through supersteps again
        execute_supersteps(new_state, supersteps, iteration + 1)

      result ->
        result
    end
  end

  defp execute_single_superstep(state, superstep_name) do
    start_time = System.monotonic_time()

    with {:ok, old_states} <- get_processor_states(state),
         {:ok, new_states} <- execute_compute_phase(state, superstep_name),
         converged? <- check_convergence(state, superstep_name, old_states, new_states),
         {:ok, _} <- execute_communicate_phase(state),
         :ok <- execute_barrier_phase(state) do

      duration = System.monotonic_time() - start_time

      emit_telemetry(:superstep_completed, %{
        superstep: superstep_name,
        duration: duration,
        converged: converged?
      })

      if converged? do
        {:converged, state}
      else
        {:continue, %{state | current_superstep: superstep_name}}
      end
    else
      {:error, reason} = error ->
        Logger.error("Superstep #{superstep_name} failed: #{inspect(reason)}")
        error
    end
  end

  defp get_processor_states(state) do
    states = Enum.map(state.processors, fn pid ->
      Processor.get_state(pid)
    end)

    {:ok, states}
  end

  defp execute_compute_phase(state, superstep_name) do
    Logger.debug("Compute phase: #{superstep_name}")

    # Execute compute in parallel on all processors
    tasks = Enum.map(state.processors, fn pid ->
      Task.async(fn -> Processor.compute(pid, superstep_name) end)
    end)

    results = Task.await_many(tasks, :infinity)

    if Enum.all?(results, &match?({:ok, _}, &1)) do
      new_states = Enum.map(results, fn {:ok, state} -> state end)
      {:ok, new_states}
    else
      error = Enum.find(results, &match?({:error, _}, &1))
      error
    end
  end

  defp execute_communicate_phase(state) do
    Logger.debug("Communicate phase")

    # Collect messages from all processors
    tasks = Enum.map(state.processors, fn pid ->
      Task.async(fn -> Processor.communicate(pid) end)
    end)

    results = Task.await_many(tasks, :infinity)

    case results do
      results when is_list(results) ->
        # Route messages to destination processors
        all_messages = Enum.flat_map(results, fn {:ok, msgs} -> msgs end)
        route_messages(state, all_messages)
        {:ok, :messages_routed}

      error ->
        error
    end
  end

  defp route_messages(state, messages) do
    # Group messages by destination processor
    grouped = Enum.group_by(messages, &elem(&1, 0), &elem(&1, 1))

    # Deliver to each processor
    Enum.each(grouped, fn {processor_id, msgs} ->
      pid = Enum.at(state.processors, processor_id)
      Processor.deliver_messages(pid, msgs)
    end)
  end

  defp execute_barrier_phase(state) do
    Logger.debug("Barrier phase")

    # All processors signal barrier
    Enum.each(state.processors, fn pid ->
      Processor.barrier(pid)
    end)

    # Wait for barrier
    case Barrier.wait(state.barrier, state.config.barrier_timeout) do
      :ok ->
        :ok

      {:error, :timeout} ->
        Logger.error("Barrier timeout")
        {:error, :barrier_timeout}
    end
  end

  defp check_convergence(state, superstep_name, old_states, new_states) do
    # Check convergence for each processor
    convergence_results = Enum.zip(old_states, new_states)
    |> Enum.map(fn {old_state, new_state} ->
      state.computation_module.converged?(old_state, new_state, superstep_name)
    end)

    # All must converge
    Enum.all?(convergence_results)
  end

  defp finalize_computation(state, reason) do
    Logger.info("Finalizing computation: #{reason}")

    # Finalize all processors
    results = Enum.map(state.processors, fn pid ->
      Processor.finalize(pid, reason)
    end)

    # Stop processors
    Enum.each(state.processors, &GenServer.stop(&1, :normal))

    # Stop barrier
    if state.barrier, do: GenServer.stop(state.barrier, :normal)

    case results do
      results when is_list(results) ->
        final_results = Enum.map(results, fn {:ok, result} -> result end)
        {:ok, final_results}

      error ->
        error
    end
  end

  defp partition_input(input, num_processors) when is_list(input) do
    chunk_size = div(length(input), num_processors)
    Enum.chunk_every(input, chunk_size)
  end

  defp partition_input(input, num_processors) do
    List.duplicate(input, num_processors)
  end

  defp emit_telemetry(event, measurements, metadata \\ %{}) do
    :telemetry.execute(
      [:tick_tick_clock, :coordinator, event],
      measurements,
      metadata
    )
  end
end
```

### 3. TickTickClock.Barrier

**Location**: `lib/tick_tick_clock/barrier.ex`

```elixir
defmodule TickTickClock.Barrier do
  @moduledoc """
  Implements barrier synchronization for BSP.

  All processors must reach the barrier before any can proceed.
  """

  use GenServer
  require Logger

  defstruct [:num_processors, :waiting, :waiters]

  ## Client API

  def start_link(num_processors) do
    GenServer.start_link(__MODULE__, num_processors)
  end

  @doc """
  Wait for all processors to reach barrier.
  """
  def wait(pid, timeout \\ 60_000) do
    GenServer.call(pid, :wait, timeout)
  end

  @doc """
  Reset the barrier for next superstep.
  """
  def reset(pid) do
    GenServer.cast(pid, :reset)
  end

  ## Server Callbacks

  @impl true
  def init(num_processors) do
    state = %__MODULE__{
      num_processors: num_processors,
      waiting: 0,
      waiters: []
    }

    {:ok, state}
  end

  @impl true
  def handle_call(:wait, from, state) do
    new_waiting = state.waiting + 1
    new_waiters = [from | state.waiters]

    if new_waiting == state.num_processors do
      # All processors reached barrier - release all
      Enum.each(new_waiters, fn waiter ->
        GenServer.reply(waiter, :ok)
      end)

      # Reset for next barrier
      {:noreply, %{state | waiting: 0, waiters: []}}
    else
      # Wait for more processors
      {:noreply, %{state | waiting: new_waiting, waiters: new_waiters}}
    end
  end

  @impl true
  def handle_cast(:reset, state) do
    {:noreply, %{state | waiting: 0, waiters: []}}
  end
end
```

## Testing

### test/tick_tick_clock/processor_test.exs

```elixir
defmodule TickTickClock.ProcessorTest do
  use ExUnit.Case, async: true
  alias TickTickClock.Processor

  defmodule SimpleComputation do
    use TickTickClock.BSP

    def initialize(data, _pid), do: {:ok, %{data: data, computed: false}}

    superstep :simple do
      compute fn state ->
        {:ok, %{state | computed: true}}
      end
    end
  end

  setup do
    {:ok, coordinator_pid} = Agent.start_link(fn -> nil end)
    
    {:ok, pid} = Processor.start_link(
      processor_id: 0,
      computation_module: SimpleComputation,
      coordinator_pid: coordinator_pid
    )

    %{processor: pid}
  end

  test "initializes with data", %{processor: pid} do
    assert :ok = Processor.initialize(pid, [1, 2, 3])
    state = Processor.get_state(pid)
    assert state.data == [1, 2, 3]
  end

  test "executes compute phase", %{processor: pid} do
    Processor.initialize(pid, [1, 2, 3])
    assert {:ok, _} = Processor.compute(pid, :simple)
    state = Processor.get_state(pid)
    assert state.computed == true
  end

  test "delivers messages", %{processor: pid} do
    Processor.initialize(pid, [])
    Processor.deliver_messages(pid, [:msg1, :msg2])
    
    # Give async cast time to process
    Process.sleep(10)
    
    {:ok, _} = Processor.compute(pid, :simple)
    # Inbox should be available in compute
  end
end
```

### test/tick_tick_clock/coordinator_test.exs

```elixir
defmodule TickTickClock.CoordinatorTest do
  use ExUnit.Case
  alias TickTickClock.Coordinator

  defmodule TestComputation do
    use TickTickClock.BSP

    def initialize(data, _), do: {:ok, %{value: data, iteration: 0}}

    superstep :increment do
      compute fn state ->
        {:ok, %{state | value: state.value + 1, iteration: state.iteration + 1}}
      end

      converged? fn _old, new ->
        new.iteration >= 3
      end
    end
  end

  test "runs simple computation to convergence" do
    {:ok, pid} = Coordinator.start_link(TestComputation, 0, processors: 2)
    
    assert {:ok, results} = Coordinator.run(pid, 10_000)
    assert length(results) == 2
    assert Enum.all?(results, fn %{iteration: i} -> i >= 3 end)
  end

  test "respects max supersteps" do
    defmodule NeverConverges do
      use TickTickClock.BSP

      def initialize(data, _), do: {:ok, %{value: data}}

      superstep :loop do
        compute fn state ->
          {:ok, %{state | value: state.value + 1}}
        end
      end
    end

    {:ok, pid} = Coordinator.start_link(NeverConverges, 0, 
      processors: 1, 
      max_supersteps: 5
    )
    
    assert {:ok, _} = Coordinator.run(pid, 10_000)
  end
end
```

## Integration Example

### examples/parallel_sum.exs

```elixir
defmodule ParallelSum do
  use TickTickClock.BSP

  def initialize(numbers, processor_id) do
    {:ok, %{
      processor_id: processor_id,
      local_sum: Enum.sum(numbers),
      global_sum: 0
    }}
  end

  superstep :share_sums do
    compute fn state -> {:ok, state} end

    communicate do
      send_to :all, fn state ->
        # Send to processor 0
        [{0, state.local_sum}]
      end
    end
  end

  superstep :compute_global do
    compute fn state ->
      if state.processor_id == 0 do
        total = Enum.sum(state.inbox)
        {:ok, %{state | global_sum: total}}
      else
        {:ok, state}
      end
    end

    converged? fn _, _ -> true end
  end
end

# Run
numbers = 1..100 |> Enum.to_list()
{:ok, coordinator} = TickTickClock.Coordinator.start_link(ParallelSum, numbers, processors: 4)
{:ok, results} = TickTickClock.Coordinator.run(coordinator)

IO.inspect(results, label: "Results")
```

## Validation Checklist

- [ ] Processor GenServer starts and initializes
- [ ] Compute phase executes correctly
- [ ] Messages route between processors
- [ ] Barrier synchronization works
- [ ] Coordinator orchestrates supersteps
- [ ] Convergence detection works
- [ ] Max supersteps enforced
- [ ] Telemetry events emitted
- [ ] Error handling for failures
- [ ] Tests pass
- [ ] Integration example runs

## Next Steps

- **Phase 3**: Advanced communication patterns
- **Phase 4**: Fault tolerance and recovery
- **Phase 5**: Performance optimization
- **Phase 6**: Stellarmorphism type integration
- **Phase 7**: Phoenix LiveView dashboard

## Notes for AI

1. **GenServer patterns**: Use call for synchronous, cast for async
2. **Timeout handling**: Always specify timeouts for calls
3. **Task.await_many**: For parallel execution
4. **Message routing**: Group by destination for efficiency
5. **Telemetry**: Emit at key points for observability
6. **Error propagation**: Use with statements for clean error handling
7. **Supervision**: Designed to crash and restart safely