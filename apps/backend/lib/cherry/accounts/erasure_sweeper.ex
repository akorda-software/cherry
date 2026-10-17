defmodule Cherry.Accounts.ErasureSweeper do
  @moduledoc "Retries external erasures without keeping deleted accounts alive."
  use GenServer
  require Logger

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_) do
    if Cherry.Repo.config()[:pool] == Ecto.Adapters.SQL.Sandbox do
      :ignore
    else
      Process.send_after(self(), :sweep, 10_000)
      {:ok, nil}
    end
  end

  @impl true
  def handle_info(:sweep, state) do
    try do
      Cherry.Accounts.ErasureTasks.sweep()

      if Cherry.Recovery.Journal.enabled?() do
        case Cherry.Recovery.Journal.replay() do
          {:ok, _} -> :ok
          _ -> Logger.warning("Recovery journal replay pending; external instructions retained")
        end
      end
    rescue
      _ -> Logger.warning("External erasure sweep failed; pending instructions retained")
    end

    Process.send_after(self(), :sweep, 60_000)
    {:noreply, state}
  end
end
