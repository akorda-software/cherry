defmodule Cherry.Dating.PhotoStorageSweeper do
  @moduledoc """
  Ejecuta periódicamente `Cherry.Dating.PhotoStorage.sweep/1`: borra los objetos
  de fotos borradas o de cuentas borradas que quedaron pendientes y los de
  subidas caducadas sin completar. Idempotente: varios nodos pueden ejecutarlo
  a la vez (borrar un objeto inexistente es `:ok`).

  Config: `config :cherry, :photo_storage_sweeper, enabled: true,
  interval_ms: 600_000, initial_delay_ms: 60_000, batch_size: 200` (todas opcionales).
  Cada tick limpia como máximo `batch_size` filas de cada tipo (1–1000).
  El intervalo debe ser positivo y el retraso inicial no negativo (milisegundos).
  """

  use GenServer

  require Logger

  alias Cherry.Dating.PhotoStorage

  @default_interval_ms :timer.minutes(10)
  @default_initial_delay_ms :timer.minutes(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  # Disabled by default under the Ecto SQL sandbox (tests), like
  # `Cherry.Dating.MatchExpirySweeper`.
  @impl true
  def init(opts) do
    config = Keyword.merge(Application.get_env(:cherry, :photo_storage_sweeper, []), opts)

    if Keyword.get(config, :enabled, not sandbox_pool?()) do
      batch_size =
        PhotoStorage.batch_size!(Keyword.get(config, :batch_size, PhotoStorage.batch_size!()))

      interval_ms = Keyword.get(config, :interval_ms, @default_interval_ms)
      initial_delay_ms = Keyword.get(config, :initial_delay_ms, @default_initial_delay_ms)

      unless is_integer(interval_ms) and interval_ms > 0,
        do: raise(ArgumentError, "photo storage interval_ms must be positive")

      unless is_integer(initial_delay_ms) and initial_delay_ms >= 0,
        do: raise(ArgumentError, "photo storage initial_delay_ms must be non-negative")

      schedule(initial_delay_ms)
      {:ok, %{interval_ms: interval_ms, batch_size: batch_size}}
    else
      :ignore
    end
  end

  @impl true
  def handle_info(:sweep, state) do
    sweep(state.batch_size)
    schedule(state.interval_ms)
    {:noreply, state}
  end

  defp sweep(batch_size) do
    case PhotoStorage.sweep(DateTime.utc_now(), batch_size) do
      %{photos: 0, intents: 0} ->
        :ok

      %{photos: photos, intents: intents} ->
        Logger.info("Photo storage sweep: #{photos} photos, #{intents} upload intents cleaned")
    end
  rescue
    error -> Logger.warning("Photo storage sweep failed: #{Exception.message(error)}")
  end

  defp schedule(delay_ms), do: Process.send_after(self(), :sweep, delay_ms)

  defp sandbox_pool?, do: Cherry.Repo.config()[:pool] == Ecto.Adapters.SQL.Sandbox
end
