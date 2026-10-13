defmodule Cherry.TestSupport.ConcurrentDB do
  @moduledoc """
  Runs database races over independent, committed connections. The caller must
  use a synchronous test and clean up its fixtures: a shared sandbox connection
  would serialize the operations and hide the race.
  """

  import ExUnit.Assertions

  alias Ecto.Adapters.SQL.Sandbox
  alias Cherry.Repo

  def race(lock_query, operations) do
    {:ok, tasks} =
      Repo.transaction(fn ->
        Repo.all(lock_query)
        tasks = Enum.map(operations, &Task.async(fn -> on_connection(&1) end))
        wait_until_blocked(length(tasks))
        tasks
      end)

    Task.await_many(tasks, 15_000)
  end

  defp on_connection(operation) do
    :ok = Sandbox.checkout(Repo, sandbox: false)

    try do
      operation.()
    rescue
      exception -> {:raised, exception.__struct__}
    after
      Sandbox.checkin(Repo)
    end
  end

  defp wait_until_blocked(expected, attempts \\ 500) do
    %{rows: [[blocked]]} =
      Repo.query!("""
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND pid <> pg_backend_pid()
      """)

    cond do
      blocked >= expected ->
        :ok

      attempts == 0 ->
        flunk("expected #{expected} concurrent operations, saw #{blocked} waiting")

      true ->
        Process.sleep(10)
        wait_until_blocked(expected, attempts - 1)
    end
  end
end
