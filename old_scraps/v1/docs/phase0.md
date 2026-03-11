# TickTickClock Phase 0: Project Foundation

## Overview
This document provides complete specifications for creating the foundational structure of TickTickClock, a Bulk Synchronous Parallel (BSP) computing framework for Elixir. This phase establishes the project scaffolding, core dependencies, and basic module structure.

## Project Goals
- Create a production-ready Elixir library project
- Set up modern Elixir tooling (Mix, ExDoc, Credo, Dialyzer)
- Establish testing infrastructure
- Define core module hierarchy
- Integrate with Stellarmorphism type system
- Prepare for Ash Framework patterns

## Prerequisites
- Elixir 1.15+ 
- Erlang/OTP 26+
- Git for version control
- Understanding of BSP model fundamentals

## Project Structure

```
ticktickclock/
├── lib/
│   ├── tick_tick_clock.ex                 # Main module
│   ├── tick_tick_clock/
│   │   ├── bsp.ex                          # Core BSP behavior
│   │   ├── superstep.ex                    # Superstep definition DSL
│   │   ├── processor.ex                    # GenServer-based processor
│   │   ├── coordinator.ex                  # Superstep coordinator
│   │   ├── barrier.ex                      # Synchronization barrier
│   │   ├── types.ex                        # Core type definitions
│   │   └── telemetry.ex                    # Instrumentation
├── test/
│   ├── tick_tick_clock_test.exs
│   ├── test_helper.exs
│   └── support/
│       └── test_helpers.ex
├── config/
│   ├── config.exs
│   ├── dev.exs
│   ├── test.exs
│   └── prod.exs
├── benchmarks/                             # Performance benchmarking
├── examples/                               # Example BSP programs
├── docs/                                   # Additional documentation
├── .formatter.exs
├── .credo.exs
├── .dialyzer_ignore.exs
├── mix.exs
├── README.md
├── LICENSE
└── CHANGELOG.md
```

## Step 1: Create Project

```bash
mix new tick_tick_clock --module TickTickClock --sup
cd tick_tick_clock
```

## Step 2: Configure mix.exs

```elixir
defmodule TickTickClock.MixProject do
  use Mix.Project

  @version "0.1.0"
  @source_url "https://github.com/yourusername/ticktickclock"

  def project do
    [
      app: :tick_tick_clock,
      version: @version,
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      
      # Testing
      test_coverage: [tool: ExCoveralls],
      preferred_cli_env: [
        coveralls: :test,
        "coveralls.detail": :test,
        "coveralls.post": :test,
        "coveralls.html": :test
      ],
      
      # Docs
      name: "TickTickClock",
      source_url: @source_url,
      homepage_url: "https://ticktickclock.com",
      docs: docs(),
      
      # Package
      package: package(),
      description: description(),
      
      # Dialyzer
      dialyzer: [
        plt_add_apps: [:ex_unit],
        plt_file: {:no_warn, "priv/plts/dialyzer.plt"},
        flags: [:unmatched_returns, :error_handling, :underspecs]
      ],
      
      # Aliases
      aliases: aliases()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :telemetry],
      mod: {TickTickClock.Application, []}
    ]
  end

  defp deps do
    [
      # Core dependencies
      {:telemetry, "~> 1.2"},
      {:telemetry_metrics, "~> 0.6"},
      {:telemetry_poller, "~> 1.0"},
      
      # Type system integration
      # {:stellarmorphism, "~> 1.0"}, # Uncomment when available
      
      # Development & Testing
      {:ex_doc, "~> 0.31", only: :dev, runtime: false},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false},
      {:excoveralls, "~> 0.18", only: :test},
      {:benchee, "~> 1.3", only: [:dev, :test]},
      {:stream_data, "~> 0.6", only: :test},
      
      # Optional integrations (for future phases)
      # {:ash, "~> 3.0", optional: true},
      # {:phoenix_live_view, "~> 0.20", optional: true}
    ]
  end

  defp docs do
    [
      main: "TickTickClock",
      logo: "assets/logo.png",
      extras: [
        "README.md",
        "CHANGELOG.md",
        "LICENSE",
        "docs/getting_started.md",
        "docs/concepts.md",
        "docs/examples.md"
      ],
      groups_for_modules: [
        "Core": [
          TickTickClock,
          TickTickClock.BSP,
          TickTickClock.Superstep
        ],
        "Runtime": [
          TickTickClock.Processor,
          TickTickClock.Coordinator,
          TickTickClock.Barrier
        ],
        "Types & Utilities": [
          TickTickClock.Types,
          TickTickClock.Telemetry
        ]
      ]
    ]
  end

  defp package do
    [
      name: "tick_tick_clock",
      licenses: ["MIT"],
      links: %{
        "GitHub" => @source_url,
        "Website" => "https://ticktickclock.com"
      },
      files: ~w(lib .formatter.exs mix.exs README.md LICENSE CHANGELOG.md)
    ]
  end

  defp description do
    """
    Declarative bulk synchronous parallel (BSP) computing for Elixir.
    Build distributed algorithms with predictable performance and zero deadlocks.
    """
  end

  defp aliases do
    [
      setup: ["deps.get", "compile"],
      quality: ["format", "credo --strict", "dialyzer"],
      "test.all": ["test", "quality"]
    ]
  end
end
```

## Step 3: Main Application Module

### lib/tick_tick_clock.ex

```elixir
defmodule TickTickClock do
  @moduledoc """
  TickTickClock - Bulk Synchronous Parallel computing for Elixir.

  TickTickClock provides a declarative, type-safe framework for building
  parallel algorithms using the Bulk Synchronous Parallel (BSP) model.

  ## Key Concepts

  - **Superstep**: The fundamental unit of BSP computation, consisting of:
    - Local computation phase
    - Communication phase
    - Barrier synchronization
  
  - **Processor**: A GenServer that executes computation on a partition of data
  
  - **Coordinator**: Orchestrates superstep execution across all processors

  ## Example

      defmodule MyApp.PageRank do
        use TickTickClock.BSP

        superstep :calculate_rank do
          compute fn vertex ->
            new_rank = 0.15 + 0.85 * sum(vertex.inbox)
            {:ok, %{vertex | rank: new_rank}}
          end

          communicate do
            send_to :neighbors, fn vertex ->
              contribution = vertex.rank / length(vertex.edges)
              Enum.map(vertex.edges, &{&1, contribution})
            end
          end

          converged? fn old, new ->
            abs(new.rank - old.rank) < 0.0001
          end
        end
      end

  ## BSP Cost Model

  The cost of a superstep is: `T = w + h*g + l`

  Where:
  - `w` = maximum computation time
  - `h` = maximum messages sent/received
  - `g` = communication gap (cost per message)
  - `l` = synchronization latency
  """

  @doc """
  Returns the version of TickTickClock.
  """
  @spec version() :: String.t()
  def version do
    Application.spec(:tick_tick_clock, :vsn) |> to_string()
  end

  @doc """
  Starts a BSP computation.

  ## Options

  - `:processors` - Number of processors (default: System.schedulers_online())
  - `:max_supersteps` - Maximum supersteps before termination
  - `:telemetry_prefix` - Prefix for telemetry events

  ## Examples

      TickTickClock.run(MyApp.PageRank, 
        input: graph_data,
        processors: 4
      )
  """
  @spec run(module(), keyword()) :: {:ok, any()} | {:error, term()}
  def run(computation_module, opts \\ []) do
    # Placeholder - will be implemented in Phase 1
    {:error, :not_implemented}
  end
end
```

### lib/tick_tick_clock/application.ex

```elixir
defmodule TickTickClock.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Telemetry supervisor
      {Telemetry.Supervisor, telemetry_config()},
      
      # Dynamic supervisor for BSP computations
      {DynamicSupervisor, strategy: :one_for_one, name: TickTickClock.ComputationSupervisor}
    ]

    opts = [strategy: :one_for_one, name: TickTickClock.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp telemetry_config do
    [
      metrics: TickTickClock.Telemetry.metrics(),
      prefix: [:tick_tick_clock]
    ]
  end
end
```

## Step 4: Configuration Files

### config/config.exs

```elixir
import Config

config :tick_tick_clock,
  # Default number of processors
  default_processors: System.schedulers_online(),
  
  # Telemetry configuration
  telemetry_enabled: true,
  
  # Barrier synchronization timeout (ms)
  barrier_timeout: 60_000,
  
  # Default superstep timeout (ms)
  superstep_timeout: 300_000

# Import environment specific config
import_config "#{config_env()}.exs"
```

### config/dev.exs

```elixir
import Config

config :tick_tick_clock,
  telemetry_enabled: true,
  log_level: :debug
```

### config/test.exs

```elixir
import Config

config :tick_tick_clock,
  telemetry_enabled: false,
  barrier_timeout: 5_000,
  superstep_timeout: 10_000
```

### config/prod.exs

```elixir
import Config

config :tick_tick_clock,
  telemetry_enabled: true,
  log_level: :info
```

## Step 5: Code Quality Tools

### .formatter.exs

```elixir
[
  inputs: ["{mix,.formatter}.exs", "{config,lib,test}/**/*.{ex,exs}"],
  line_length: 100,
  import_deps: [:telemetry]
]
```

### .credo.exs

```elixir
%{
  configs: [
    %{
      name: "default",
      files: %{
        included: ["lib/", "test/"],
        excluded: [~r"/_build/", ~r"/deps/"]
      },
      strict: true,
      color: true,
      checks: [
        {Credo.Check.Readability.ModuleDoc, false},
        {Credo.Check.Design.AliasUsage, priority: :low}
      ]
    }
  ]
}
```

### .dialyzer_ignore.exs

```elixir
[
  # Add patterns for known dialyzer warnings to ignore
]
```

## Step 6: Documentation Structure

### README.md

```markdown
# TickTickClock 🕰️

Declarative bulk synchronous parallel (BSP) computing for Elixir.

## Installation

Add `tick_tick_clock` to your list of dependencies in `mix.exs`:

\```elixir
def deps do
  [
    {:tick_tick_clock, "~> 0.1.0"}
  ]
end
\```

## Quick Start

\```elixir
defmodule MyApp.PageRank do
  use TickTickClock.BSP

  superstep :calculate_rank do
    compute fn vertex ->
      new_rank = 0.15 + 0.85 * sum(vertex.inbox)
      {:ok, %{vertex | rank: new_rank}}
    end

    communicate do
      send_to :neighbors, fn vertex ->
        contribution = vertex.rank / length(vertex.edges)
        Enum.map(vertex.edges, &{&1, contribution})
      end
    end

    converged? fn old, new ->
      abs(new.rank - old.rank) < 0.0001
    end
  end
end

# Run the computation
TickTickClock.run(MyApp.PageRank, input: graph_data)
\```

## Features

- 🎯 **Declarative** - Define what to compute, not how to synchronize
- 🔒 **Type-safe** - Compile-time guarantees with Stellarmorphism
- 📊 **Predictable** - BSP cost model for performance analysis
- 🚫 **Deadlock-free** - By design
- ⚡ **BEAM-native** - OTP supervision and distribution

## Documentation

See [HexDocs](https://hexdocs.pm/tick_tick_clock) for full documentation.

## Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## License

MIT License - see LICENSE file.
```

### CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure
- Core BSP behavior definitions
- Telemetry integration
- Documentation framework

## [0.1.0] - 2025-01-XX

### Added
- Initial release
- Basic BSP computation model
- Processor GenServers
- Barrier synchronization
- Superstep DSL
```

## Step 7: Testing Infrastructure

### test/test_helper.exs

```elixir
ExUnit.start()

# Configure ExUnit
ExUnit.configure(
  exclude: [:skip, :pending],
  formatters: [ExUnit.CLIFormatter],
  trace: false,
  max_cases: System.schedulers_online() * 2
)
```

### test/tick_tick_clock_test.exs

```elixir
defmodule TickTickClockTest do
  use ExUnit.Case, async: true
  doctest TickTickClock

  describe "version/0" do
    test "returns version string" do
      assert is_binary(TickTickClock.version())
    end
  end

  describe "run/2" do
    test "returns not implemented error" do
      assert {:error, :not_implemented} = TickTickClock.run(SomeModule)
    end
  end
end
```

### test/support/test_helpers.ex

```elixir
defmodule TickTickClock.TestHelpers do
  @moduledoc """
  Helper functions for testing BSP computations.
  """

  @doc """
  Creates a simple test graph for BSP algorithms.
  """
  def create_test_graph(num_vertices) do
    # Placeholder implementation
    %{vertices: num_vertices, edges: []}
  end

  @doc """
  Waits for all processors to reach a barrier.
  """
  def wait_for_barrier(processors, timeout \\ 5_000) do
    # Placeholder implementation
    :ok
  end
end
```

## Step 8: Benchmarking Setup

### benchmarks/simple_benchmark.exs

```elixir
# Simple benchmark to verify setup
Benchee.run(%{
  "list iteration" => fn -> Enum.map(1..1000, & &1 * 2) end,
  "comprehension" => fn -> for n <- 1..1000, do: n * 2 end
})
```

## Step 9: Git Setup

### .gitignore

```
# The directory Mix will write compiled artifacts to.
/_build/

# If you run "mix test --cover", coverage assets end up here.
/cover/

# The directory Mix downloads your dependencies sources to.
/deps/

# Where third-party dependencies like ExDoc output generated docs.
/doc/

# Ignore .fetch files in case you like to edit your project deps locally.
/.fetch

# If the VM crashes, it generates a dump, let's ignore it too.
erl_crash.dump

# Also ignore archive artifacts (built via "mix archive.build").
*.ez

# Ignore package tarball (built via "mix hex.build").
tick_tick_clock-*.tar

# Temporary files, for example, from tests.
/tmp/

# IDE
.elixir_ls/
.vscode/
.idea/

# Dialyzer
/priv/plts/*.plt
/priv/plts/*.plt.hash

# Environment variables
.env
.env.local
```

## Step 10: Initial Commit

```bash
git init
git add .
git commit -m "Initial commit: TickTickClock Phase 0 foundation"
```

## Validation Checklist

- [ ] Project compiles: `mix compile`
- [ ] Tests pass: `mix test`
- [ ] Formatter runs: `mix format --check-formatted`
- [ ] Credo passes: `mix credo --strict`
- [ ] Dialyzer runs: `mix dialyzer` (may have warnings initially)
- [ ] Docs generate: `mix docs`
- [ ] Dependencies install: `mix deps.get`

## Next Steps

After completing Phase 0:
- **Phase 1**: Implement core BSP behavior and Superstep DSL
- **Phase 2**: Build Processor GenServers and Coordinator
- **Phase 3**: Implement communication and barrier synchronization
- **Phase 4**: Add Stellarmorphism type integration
- **Phase 5**: Create example BSP programs

## Notes for AI Implementation

1. **Follow Elixir conventions**: Use snake_case for files, PascalCase for modules
2. **Documentation**: Every public function needs @doc, @spec
3. **Testing**: Write tests alongside implementation
4. **Type specs**: Use @spec for all public functions
5. **Error handling**: Return {:ok, result} | {:error, reason} tuples
6. **Supervision**: Design for crash-only software
7. **Telemetry**: Instrument all significant operations
8. **Configuration**: Use Application.get_env/3 for runtime config

## References

- BSP Model: Valiant, L. G. (1990). "A bridging model for parallel computation"
- Elixir Style Guide: https://github.com/christopheradams/elixir_style_guide
- OTP Design Principles: https://www.erlang.org/doc/design_principles/des_princ.html