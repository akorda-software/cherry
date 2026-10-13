defmodule Cherry.Dating.MatchExpirySweeper do
  @moduledoc """
  Proceso ligero que marca periódicamente los matches caducados
  (`Cherry.Dating.MatchExpiry.expire_stale/1`). La caducidad ya se aplica de forma
  perezosa en lecturas y mensajería; esto solo mantiene `matches.status` veraz
  para admin/analítica. Idempotente: varios nodos pueden ejecutarlo a la vez.

  Config: `config :cherry, :match_expiry_sweeper, enabled: true, interval_ms: 3_600_000,
  initial_delay_ms: 60_000` (todas opcionales).
  """

  use GenServer

  require Logger

  alias Cherry.Dating.MatchExpiry

  @default_interval_ms :timer.hours(1)
  @default_initial_delay_ms :timer.minutes(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  # Disabled by default under the Ecto SQL sandbox (tests), like
  # `Cherry.Dating.Discovery.TagWeights`.
  @impl true
  def init(opts) do
    config = Keyword.merge(Application.get_env(:cherry, :match_expiry_sweeper, []), opts)

    if Keyword.get(config, :enabled, not sandbox_pool?()) do
      schedule(Keyword.get(config, :initial_delay_ms, @default_initial_delay_ms))
      {:ok, %{interval_ms: Keyword.get(config, :interval_ms, @default_interval_ms)}}
    else
      :ignore
    end
  end

  @impl true
  def handle_info(:sweep, state) do
    sweep()
    schedule(state.interval_ms)
    {:noreply, state}
  end

  defp sweep do
    case MatchExpiry.expire_stale() do
      0 -> :ok
      count -> Logger.info("Match expiry sweep: #{count} matches marked as expired")
    end
  rescue
    error -> Logger.warning("Match expiry sweep failed: #{Exception.message(error)}")
  end

  defp schedule(delay_ms), do: Process.send_after(self(), :sweep, delay_ms)

  defp sandbox_pool?, do: Cherry.Repo.config()[:pool] == Ecto.Adapters.SQL.Sandbox
end
