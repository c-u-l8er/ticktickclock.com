# TickTickClock Phase 1: Core BSP Behavior & Superstep DSL

## Overview
This phase implements the core `use TickTickClock.BSP` behavior and the declarative Superstep DSL that developers will use to define BSP computations. This is the heart of the framework's developer experience.

## Goals
- Implement `TickTickClock.BSP` behavior with `__using__` macro
- Create Superstep DSL for declarative computation definition
- Build AST manipulation for compile-time validation
- Generate processor callback functions from DSL
- Implement basic type checking integration points

## Core Modules to Implement

### 1. TickTickClock.BSP (Main Behavior)

**Location**: `lib/tick_tick_clock/bsp.ex`

```elixir
defmodule TickTickClock.BSP do
  @moduledoc """
  Behavior for defining BSP computations.

  When you `use TickTickClock.BSP`, your module gains:
  - `superstep/2` macro for defining computation phases
  - `compute/1` macro for local computation
  - `communicate/1` macro for message passing
  - `barrier/1` macro for synchronization
  - Compile-time validation of BSP structure
  - Generated callback functions

  ## Example

      defmodule MyComputation do
        use TickTickClock.BSP

        superstep :phase1 do
          compute fn state ->
            {:ok, updated_state}
          end

          communicate do
            send_to :all, fn state ->
              [{neighbor_id, message}]
            end
          end

          converged? fn old_state, new_state ->
            old_state == new_state
          end
        end
      end
  """

  @doc """
  Callback invoked when BSP computation is initialized.
  
  Return initial state for each processor.
  """
  @callback initialize(input :: any(), processor_id :: non_neg_integer()) :: 
    {:ok, state :: any()} | {:error, reason :: term()}

  @doc """
  Callback for computing the next state based on current state and received messages.
  """
  @callback compute(state :: any(), messages :: list(), superstep :: atom()) ::
    {:ok, new_state :: any()} | {:error, reason :: term()}

  @doc """
  Callback for generating messages to send to other processors.
  """
  @callback communicate(state :: any(), superstep :: atom()) ::
    {:ok, messages :: list({processor_id :: non_neg_integer(), message :: any()})} |
    {:error, reason :: term()}

  @doc """
  Callback to determine if computation has converged and should terminate.
  """
  @callback converged?(old_state :: any(), new_state :: any(), superstep :: atom()) ::
    boolean()

  @doc """
  Optional callback for cleanup after computation completes.
  """
  @callback finalize(state :: any(), reason :: :converged | :max_supersteps | :error) ::
    {:ok, result :: any()} | {:error, term()}

  @optional_callbacks [initialize: 2, finalize: 3]

  defmacro __using__(opts) do
    quote location: :keep do
      @behaviour TickTickClock.BSP

      # Store module configuration
      Module.register_attribute(__MODULE__, :supersteps, accumulate: true)
      Module.register_attribute(__MODULE__, :bsp_config, accumulate: false)
      Module.put_attribute(__MODULE__, :bsp_config, unquote(opts))

      # Import DSL macros
      import TickTickClock.BSP, only: [superstep: 2, config: 1]

      # Default implementations
      def initialize(input, processor_id) do
        # Default: evenly partition input across processors
        {:ok, partition_input(input, processor_id)}
      end

      def finalize(state, _reason) do
        {:ok, state}
      end

      defoverridable initialize: 2, finalize: 3

      # Hook for compile-time validation
      @before_compile TickTickClock.BSP
    end
  end

  defmacro __before_compile__(env) do
    supersteps = Module.get_attribute(env.module, :supersteps)
    config = Module.get_attribute(env.module, :bsp_config) || []

    # Validate supersteps are defined
    if supersteps == [] do
      raise CompileError,
        file: env.file,
        line: env.line,
        description: "BSP module must define at least one superstep"
    end

    # Generate superstep metadata function
    quote do
      def __bsp_supersteps__, do: unquote(Macro.escape(supersteps))
      def __bsp_config__, do: unquote(Macro.escape(config))

      # Generate compute callback that routes to appropriate superstep
      def compute(state, messages, superstep_name) do
        case superstep_name do
          unquote_splicing(generate_compute_clauses(supersteps))
          _ -> {:error, {:unknown_superstep, superstep_name}}
        end
      end

      # Generate communicate callback
      def communicate(state, superstep_name) do
        case superstep_name do
          unquote_splicing(generate_communicate_clauses(supersteps))
          _ -> {:error, {:unknown_superstep, superstep_name}}
        end
      end

      # Generate converged? callback
      def converged?(old_state, new_state, superstep_name) do
        case superstep_name do
          unquote_splicing(generate_converged_clauses(supersteps))
          _ -> false
        end
      end
    end
  end

  @doc """
  Macro for defining a superstep.

  ## Examples

      superstep :calculate do
        compute fn state ->
          {:ok, updated_state}
        end

        communicate do
          send_to :neighbors, fn state ->
            messages
          end
        end

        converged? fn old, new ->
          old == new
        end
      end
  """
  defmacro superstep(name, do: block) when is_atom(name) do
    quote do
      TickTickClock.BSP.__define_superstep__(__MODULE__, unquote(name), unquote(block))
    end
  end

  @doc false
  def __define_superstep__(module, name, block) do
    # Parse the block to extract compute, communicate, and converged? definitions
    {compute_fn, communicate_fn, converged_fn, opts} = parse_superstep_block(block)

    superstep = %{
      name: name,
      compute: compute_fn,
      communicate: communicate_fn,
      converged: converged_fn,
      opts: opts
    }

    Module.put_attribute(module, :supersteps, superstep)
  end

  @doc """
  Macro for configuration block inside superstep.

  ## Examples

      superstep :phase1 do
        config do
          max_iterations: 100,
          timeout: 60_000
        end

        compute fn state -> ... end
      end
  """
  defmacro config(do: block) do
    quote do
      unquote(block)
    end
  end

  @doc """
  Macro for defining the compute phase.
  """
  defmacro compute(fun) do
    quote do
      unquote(fun)
    end
  end

  @doc """
  Macro for defining the communicate phase.
  """
  defmacro communicate(do: block) do
    quote do
      unquote(block)
    end
  end

  @doc """
  Macro for sending messages to processors.

  ## Communication Patterns

      # Send to all processors
      send_to :all, fn state ->
        [{0, msg1}, {1, msg2}]
      end

      # Send to specific processors
      send_to :specific, fn state ->
        [{target_id, message}]
      end

      # Send to neighbors (requires graph topology)
      send_to :neighbors, fn state ->
        state.edges |> Enum.map(&{&1, state.value})
      end

      # Hash partition
      send_to :hash_partition, fn state ->
        state.data |> Enum.map(fn item ->
          {hash(item) |> rem(num_processors), item}
        end)
      end
  """
  defmacro send_to(pattern, fun) do
    quote do
      {unquote(pattern), unquote(fun)}
    end
  end

  @doc """
  Macro for aggregating received messages.
  """
  defmacro aggregate(fun) do
    quote do
      {:aggregate, unquote(fun)}
    end
  end

  @doc """
  Macro for defining convergence criteria.
  """
  defmacro converged?(fun) do
    quote do
      unquote(fun)
    end
  end

  @doc """
  Macro for defining barrier synchronization.
  """
  defmacro barrier(type) when is_atom(type) do
    quote do
      {:barrier, unquote(type)}
    end
  end

  # Private helpers

  defp parse_superstep_block(block) do
    # Extract compute, communicate, converged? from AST
    # This is a simplified version - full implementation would parse AST more thoroughly
    {compute, communicate, converged, opts} = extract_block_components(block)
    
    {compute, communicate, converged, opts}
  end

  defp extract_block_components({:__block__, _, expressions}) do
    # Parse each expression in the block
    Enum.reduce(expressions, {nil, nil, nil, []}, fn expr, {c, m, cv, opts} ->
      case expr do
        {:compute, _, [fun]} -> {fun, m, cv, opts}
        {:communicate, _, [[do: comm_block]]} -> {c, comm_block, cv, opts}
        {:converged?, _, [fun]} -> {c, m, fun, opts}
        {:config, _, [[do: config_block]]} -> {c, m, cv, [config: config_block | opts]}
        _ -> {c, m, cv, opts}
      end
    end)
  end

  defp extract_block_components(single_expr) do
    extract_block_components({:__block__, [], [single_expr]})
  end

  defp generate_compute_clauses(supersteps) do
    Enum.map(supersteps, fn %{name: name, compute: compute} ->
      quote do
        unquote(name) ->
          state_with_inbox = Map.put(state, :inbox, messages)
          unquote(compute).(state_with_inbox)
      end
    end)
  end

  defp generate_communicate_clauses(supersteps) do
    Enum.map(supersteps, fn %{name: name, communicate: communicate} ->
      case communicate do
        nil ->
          quote do
            unquote(name) -> {:ok, []}
          end
        
        comm_block ->
          quote do
            unquote(name) ->
              case extract_messages(state, unquote(comm_block)) do
                {:ok, messages} -> {:ok, messages}
                error -> error
              end
          end
      end
    end)
  end

  defp generate_converged_clauses(supersteps) do
    Enum.map(supersteps, fn %{name: name, converged: converged} ->
      case converged do
        nil ->
          quote do
            unquote(name) -> false
          end
        
        conv_fun ->
          quote do
            unquote(name) -> unquote(conv_fun).(old_state, new_state)
          end
      end
    end)
  end

  defp extract_messages(state, comm_block) do
    # Execute communication block and extract messages
    # This handles different communication patterns
    try do
      case comm_block do
        {:send_to, _, [pattern, fun]} ->
          messages = fun.(state)
          {:ok, expand_communication_pattern(pattern, messages, state)}
        
        _ ->
          {:ok, []}
      end
    rescue
      e -> {:error, {:communication_error, e}}
    end
  end

  defp expand_communication_pattern(:all, messages, state) do
    # Broadcast to all processors
    num_processors = get_num_processors(state)
    
    Enum.flat_map(0..(num_processors - 1), fn pid ->
      Enum.map(messages, fn msg -> {pid, msg} end)
    end)
  end

  defp expand_communication_pattern(:neighbors, messages, state) do
    # Send to graph neighbors
    messages
  end

  defp expand_communication_pattern(:hash_partition, messages, state) do
    # Messages already have target processor IDs
    messages
  end

  defp expand_communication_pattern(:specific, messages, state) do
    # Direct processor-to-processor messages
    messages
  end

  defp get_num_processors(state) do
    # Get from state or config
    Map.get(state, :num_processors, System.schedulers_online())
  end

  defp partition_input(input, processor_id) when is_list(input) do
    # Simple partitioning for lists
    chunk_size = div(length(input), get_total_processors())
    start_idx = processor_id * chunk_size
    Enum.slice(input, start_idx, chunk_size)
  end

  defp partition_input(input, _processor_id), do: input

  defp get_total_processors do
    Application.get_env(:tick_tick_clock, :default_processors, System.schedulers_online())
  end
end
```

### 2. TickTickClock.Superstep (Superstep Definition)

**Location**: `lib/tick_tick_clock/superstep.ex`

```elixir
defmodule TickTickClock.Superstep do
  @moduledoc """
  Represents a single superstep in a BSP computation.

  A superstep consists of three phases:
  1. Computation - Local processing
  2. Communication - Message exchange
  3. Barrier - Synchronization

  ## Structure

      %Superstep{
        name: :calculate_rank,
        compute_fn: function,
        communicate_fn: function,
        converged_fn: function,
        config: %{...}
      }
  """

  @type t :: %__MODULE__{
    name: atom(),
    compute_fn: function(),
    communicate_fn: function() | nil,
    converged_fn: function() | nil,
    barrier_type: atom(),
    config: map()
  }

  defstruct [
    :name,
    :compute_fn,
    :communicate_fn,
    :converged_fn,
    barrier_type: :default,
    config: %{}
  ]

  @doc """
  Creates a new superstep definition.
  """
  def new(name, opts \\ []) when is_atom(name) do
    %__MODULE__{
      name: name,
      compute_fn: Keyword.get(opts, :compute),
      communicate_fn: Keyword.get(opts, :communicate),
      converged_fn: Keyword.get(opts, :converged),
      barrier_type: Keyword.get(opts, :barrier_type, :default),
      config: Keyword.get(opts, :config, %{})
    }
  end

  @doc """
  Validates a superstep definition.
  """
  def validate(%__MODULE__{compute_fn: nil}) do
    {:error, :missing_compute_function}
  end

  def validate(%__MODULE__{} = superstep) do
    {:ok, superstep}
  end

  @doc """
  Executes the compute phase of a superstep.
  """
  def execute_compute(%__MODULE__{compute_fn: compute_fn}, state, messages) do
    state_with_inbox = Map.put(state, :inbox, messages)
    
    try do
      compute_fn.(state_with_inbox)
    rescue
      e -> {:error, {:compute_error, e, __STACKTRACE__}}
    end
  end

  @doc """
  Executes the communicate phase of a superstep.
  """
  def execute_communicate(%__MODULE__{communicate_fn: nil}, _state) do
    {:ok, []}
  end

  def execute_communicate(%__MODULE__{communicate_fn: comm_fn}, state) do
    try do
      comm_fn.(state)
    rescue
      e -> {:error, {:communicate_error, e, __STACKTRACE__}}
    end
  end

  @doc """
  Checks if the computation has converged.
  """
  def check_convergence(%__MODULE__{converged_fn: nil}, _old_state, _new_state) do
    false
  end

  def check_convergence(%__MODULE__{converged_fn: conv_fn}, old_state, new_state) do
    try do
      conv_fn.(old_state, new_state)
    rescue
      _ -> false
    end
  end
end
```

### 3. TickTickClock.Types (Type Definitions)

**Location**: `lib/tick_tick_clock/types.ex`

```elixir
defmodule TickTickClock.Types do
  @moduledoc """
  Type definitions for TickTickClock.

  This module will integrate with Stellarmorphism in future phases.
  """

  @typedoc "A processor ID"
  @type processor_id :: non_neg_integer()

  @typedoc "A superstep name"
  @type superstep_name :: atom()

  @typedoc "Processor state"
  @type processor_state :: any()

  @typedoc "A message sent between processors"
  @type message :: {processor_id(), any()}

  @typedoc "Computation result"
  @type result :: {:ok, any()} | {:error, term()}

  @typedoc "BSP configuration"
  @type config :: %{
    optional(:processors) => pos_integer(),
    optional(:max_supersteps) => pos_integer(),
    optional(:timeout) => timeout(),
    optional(:barrier_timeout) => timeout()
  }

  @typedoc "Superstep phase"
  @type phase :: :compute | :communicate | :barrier

  @typedoc "Computation status"
  @type status :: :running | :converged | :terminated | :error

  @doc """
  Creates a default configuration.
  """
  def default_config do
    %{
      processors: System.schedulers_online(),
      max_supersteps: 1000,
      timeout: 300_000,
      barrier_timeout: 60_000
    }
  end

  @doc """
  Merges user config with defaults.
  """
  def merge_config(user_config) do
    Map.merge(default_config(), user_config)
  end
end
```

## Testing

### test/tick_tick_clock/bsp_test.exs

```elixir
defmodule TickTickClock.BSPTest do
  use ExUnit.Case, async: true

  describe "BSP behavior" do
    test "defines required callbacks" do
      assert TickTickClock.BSP.behaviour_info(:callbacks) == [
        compute: 3,
        communicate: 2,
        converged?: 3,
        initialize: 2,
        finalize: 3
      ]
    end

    test "compiles simple BSP module" do
      defmodule SimpleComputation do
        use TickTickClock.BSP

        superstep :phase1 do
          compute fn state ->
            {:ok, Map.update!(state, :value, &(&1 + 1))}
          end
        end
      end

      assert function_exported?(SimpleComputation, :compute, 3)
      assert function_exported?(SimpleComputation, :communicate, 2)
    end

    test "validates superstep is defined" do
      assert_raise CompileError, ~r/must define at least one superstep/, fn ->
        defmodule NoSupersteps do
          use TickTickClock.BSP
        end
      end
    end

    test "generates correct compute clauses" do
      defmodule ComputeTest do
        use TickTickClock.BSP

        superstep :double do
          compute fn state ->
            {:ok, %{state | value: state.value * 2}}
          end
        end
      end

      state = %{value: 5}
      assert {:ok, %{value: 10}} = ComputeTest.compute(state, [], :double)
    end

    test "handles communication patterns" do
      defmodule CommunicationTest do
        use TickTickClock.BSP

        superstep :broadcast do
          compute fn state -> {:ok, state} end

          communicate do
            send_to :all, fn state ->
              [{0, state.value}, {1, state.value}]
            end
          end
        end
      end

      state = %{value: 42, num_processors: 2}
      assert {:ok, messages} = CommunicationTest.communicate(state, :broadcast)
      assert length(messages) > 0
    end

    test "checks convergence" do
      defmodule ConvergenceTest do
        use TickTickClock.BSP

        superstep :converge do
          compute fn state -> {:ok, state} end

          converged? fn old, new ->
            old.value == new.value
          end
        end
      end

      old_state = %{value: 5}
      new_state = %{value: 5}
      assert ConvergenceTest.converged?(old_state, new_state, :converge)

      different_state = %{value: 6}
      refute ConvergenceTest.converged?(old_state, different_state, :converge)
    end
  end

  describe "superstep macro" do
    test "supports multiple supersteps" do
      defmodule MultiSuperstep do
        use TickTickClock.BSP

        superstep :phase1 do
          compute fn state -> {:ok, %{state | step: 1}} end
        end

        superstep :phase2 do
          compute fn state -> {:ok, %{state | step: 2}} end
        end
      end

      state = %{step: 0}
      assert {:ok, %{step: 1}} = MultiSuperstep.compute(state, [], :phase1)
      assert {:ok, %{step: 2}} = MultiSuperstep.compute(state, [], :phase2)
    end

    test "returns error for unknown superstep" do
      defmodule UnknownSuperstepTest do
        use TickTickClock.BSP

        superstep :known do
          compute fn state -> {:ok, state} end
        end
      end

      assert {:error, {:unknown_superstep, :unknown}} =
        UnknownSuperstepTest.compute(%{}, [], :unknown)
    end
  end
end
```

### test/tick_tick_clock/superstep_test.exs

```elixir
defmodule TickTickClock.SuperstepTest do
  use ExUnit.Case, async: true
  alias TickTickClock.Superstep

  describe "new/2" do
    test "creates superstep with name" do
      superstep = Superstep.new(:test)
      assert superstep.name == :test
    end

    test "accepts compute function" do
      compute_fn = fn state -> {:ok, state} end
      superstep = Superstep.new(:test, compute: compute_fn)
      assert superstep.compute_fn == compute_fn
    end
  end

  describe "validate/1" do
    test "requires compute function" do
      superstep = Superstep.new(:test)
      assert {:error, :missing_compute_function} = Superstep.validate(superstep)
    end

    test "validates complete superstep" do
      compute_fn = fn state -> {:ok, state} end
      superstep = Superstep.new(:test, compute: compute_fn)
      assert {:ok, ^superstep} = Superstep.validate(superstep)
    end
  end

  describe "execute_compute/3" do
    test "executes compute function with inbox" do
      compute_fn = fn state ->
        sum = Enum.sum(state.inbox)
        {:ok, %{state | total: sum}}
      end

      superstep = Superstep.new(:test, compute: compute_fn)
      state = %{total: 0}
      messages = [1, 2, 3]

      assert {:ok, %{total: 6}} = Superstep.execute_compute(superstep, state, messages)
    end

    test "handles compute errors" do
      compute_fn = fn _state -> raise "error" end
      superstep = Superstep.new(:test, compute: compute_fn)

      assert {:error, {:compute_error, _, _}} =
        Superstep.execute_compute(superstep, %{}, [])
    end
  end

  describe "execute_communicate/2" do
    test "returns empty list when no communicate function" do
      superstep = Superstep.new(:test, compute: fn s -> {:ok, s} end)
      assert {:ok, []} = Superstep.execute_communicate(superstep, %{})
    end

    test "executes communicate function" do
      comm_fn = fn state ->
        {:ok, [{0, state.value}, {1, state.value}]}
      end

      superstep = Superstep.new(:test, compute: fn s -> {:ok, s} end, communicate: comm_fn)
      state = %{value: 42}

      assert {:ok, messages} = Superstep.execute_communicate(superstep, state)
      assert length(messages) == 2
    end
  end

  describe "check_convergence/3" do
    test "returns false when no convergence function" do
      superstep = Superstep.new(:test, compute: fn s -> {:ok, s} end)
      refute Superstep.check_convergence(superstep, %{}, %{})
    end

    test "executes convergence check" do
      conv_fn = fn old, new -> old.value == new.value end
      superstep = Superstep.new(:test, compute: fn s -> {:ok, s} end, converged: conv_fn)

      assert Superstep.check_convergence(superstep, %{value: 5}, %{value: 5})
      refute Superstep.check_convergence(superstep, %{value: 5}, %{value: 6})
    end
  end
end
```

## Documentation Examples

### examples/hello_world.exs

```elixir
defmodule HelloWorld do
  @moduledoc """
  Simplest possible BSP computation - each processor says hello.
  """
  use TickTickClock.BSP

  superstep :greet do
    compute fn state ->
      IO.puts("Hello from processor #{state.processor_id}")
      {:ok, state}
    end
  end
end

# Run with:
# TickTickClock.run(HelloWorld, processors: 4)
```

### examples/simple_sum.exs

```elixir
defmodule SimpleSum do
  @moduledoc """
  Parallel sum - each processor computes local sum, then shares with all.
  """
  use TickTickClock.BSP

  def initialize(numbers, processor_id) do
    {:ok, %{
      processor_id: processor_id,
      local_sum: Enum.sum(numbers),
      global_sum: 0
    }}
  end

  superstep :compute_local do
    compute fn state ->
      {:ok, state}
    end

    communicate do
      send_to :all, fn state ->
        # Send local sum to all processors
        Enum.map(0..3, fn pid -> {pid, state.local_sum} end)
      end
    end
  end

  superstep :compute_global do
    compute fn state ->
      global_sum = Enum.sum(state.inbox)
      {:ok, %{state | global_sum: global_sum}}
    end

    converged? fn _old, _new ->
      true  # Converge after one iteration
    end
  end
end
```

## Validation Checklist

- [ ] BSP behavior compiles without warnings
- [ ] Superstep DSL macros work correctly
- [ ] Compute, communicate, converged? callbacks generated
- [ ] Multiple supersteps in single module
- [ ] Communication patterns (all, neighbors, hash) implemented
- [ ] Error handling for missing compute function
- [ ] Compile-time validation catches errors
- [ ] All tests pass
- [ ] Documentation examples run
- [ ] Type specs on all public functions

## Next Steps

After Phase 1:
- **Phase 2**: Implement Processor GenServers
- **Phase 3**: Build Coordinator and execution engine
- **Phase 4**: Add barrier synchronization
- **Phase 5**: Integrate with Stellarmorphism types

## Notes for AI Implementation

1. **Macro hygiene**: Use `quote location: :keep` to preserve error locations
2. **AST manipulation**: Be careful with pattern matching on AST structures
3. **Module attributes**: Use `@before_compile` for validation
4. **Behavior callbacks**: Implement all required callbacks
5. **Error messages**: Provide clear, actionable compile-time errors
6. **Testing**: Test both success and failure paths
7. **Documentation**: Each macro needs examples
8. **Type specs**: Critical for behavior callbacks