defmodule Snack.Dating.PhotoStorageSweeper do
  @moduledoc """
  Ejecuta periódicamente `Snack.Dating.PhotoStorage.sweep/1`: borra los objetos
  de fotos borradas o de cuentas borradas que quedaron pendientes y los de
  subidas caducadas sin completar. Idempotente: varios nodos pueden ejecutarlo
  a la vez (borrar un objeto inexistente es `:ok`).

  Config: `config :snack, :photo_storage_sweeper, enabled: true,
  interval_ms: 600_000, initial_delay_ms: 60_000` (todas opcionales).
  """

  use GenServer

  require Logger

  alias Snack.Dating.PhotoStorage

  @default_interval_ms :timer.minutes(10)
  @default_initial_delay_ms :timer.minutes(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  # Disabled by default under the Ecto SQL sandbox (tests), like
  # `Snack.Dating.MatchExpirySweeper`.
  @impl true
  def init(opts) do
    config = Keyword.merge(Application.get_env(:snack, :photo_storage_sweeper, []), opts)

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
    case PhotoStorage.sweep() do
      %{photos: 0, intents: 0} ->
        :ok

      %{photos: photos, intents: intents} ->
        Logger.info("Photo storage sweep: #{photos} photos, #{intents} upload intents cleaned")
    end
  rescue
    error -> Logger.warning("Photo storage sweep failed: #{Exception.message(error)}")
  end

  defp schedule(delay_ms), do: Process.send_after(self(), :sweep, delay_ms)

  defp sandbox_pool?, do: Snack.Repo.config()[:pool] == Ecto.Adapters.SQL.Sandbox
end
