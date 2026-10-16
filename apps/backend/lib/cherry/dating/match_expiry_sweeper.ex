defmodule Cherry.Dating.MatchExpirySweeper do
  @moduledoc """
  Proceso ligero que marca periódicamente los matches caducados
  (`Cherry.Dating.MatchExpiry.expire_batch/2`). La caducidad ya se aplica de forma
  perezosa en lecturas y mensajería; esto solo mantiene `matches.status` veraz
  para admin/analítica. Idempotente: varios nodos pueden ejecutarlo a la vez.

  Config: `config :cherry, :match_expiry_sweeper, enabled: true, interval_ms: 3_600_000,
  initial_delay_ms: 60_000, batch_size: 500, drain_delay_ms: 1000` (todas opcionales).
  Cada tick actualiza como máximo un lote (1–1000 filas) y omite filas bloqueadas.
  Si el lote está lleno, continúa tras `drain_delay_ms`, liberando la conexión
  entre lotes; si no, vuelve al intervalo normal.
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
      batch_size = Keyword.get(config, :batch_size, 500)
      drain_delay_ms = Keyword.get(config, :drain_delay_ms, 1000)

      unless is_integer(batch_size) and batch_size in 1..1000,
        do: raise(ArgumentError, "expiry batch size must be between 1 and 1000")

      unless is_integer(drain_delay_ms) and drain_delay_ms > 0,
        do: raise(ArgumentError, "expiry drain delay must be positive")

      schedule(Keyword.get(config, :initial_delay_ms, @default_initial_delay_ms))

      {:ok,
       %{
         interval_ms: Keyword.get(config, :interval_ms, @default_interval_ms),
         batch_size: batch_size,
         drain_delay_ms: drain_delay_ms
       }}
    else
      :ignore
    end
  end

  @impl true
  def handle_info(:sweep, state) do
    count = sweep(state.batch_size)
    schedule(if count == state.batch_size, do: state.drain_delay_ms, else: state.interval_ms)
    {:noreply, state}
  end

  defp sweep(batch_size) do
    count = MatchExpiry.expire_batch(DateTime.utc_now(), batch_size)
    if count > 0, do: Logger.info("Match expiry sweep: #{count} matches marked as expired")
    count
  rescue
    error ->
      Logger.warning("Match expiry sweep failed: #{Exception.message(error)}")
      :error
  end

  defp schedule(delay_ms), do: Process.send_after(self(), :sweep, delay_ms)

  defp sandbox_pool?, do: Cherry.Repo.config()[:pool] == Ecto.Adapters.SQL.Sandbox
end
