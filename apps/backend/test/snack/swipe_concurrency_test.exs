defmodule Snack.SwipeConcurrencyTest do
  @moduledoc """
  Real concurrency for `Snack.Dating.record_swipe/1`.

  The SQL sandbox runs every process of a test over one shared connection, which
  serialises their transactions and would hide the race (two simultaneous likes
  that both miss each other and create no match). Here each process checks out
  its own real connection (`sandbox: false`): rows are really committed and are
  deleted in `on_exit`. The module is sync, so ExUnit runs it on its own after
  every async module.
  """
  use ExUnit.Case, async: false

  import Ecto.Query
  import Snack.TestSupport.DatingFixtures

  alias Ecto.Adapters.SQL.Sandbox
  alias Snack.Accounts.User
  alias Snack.Dating
  alias Snack.Dating.Conversation
  alias Snack.Dating.Match
  alias Snack.Dating.Profile
  alias Snack.Dating.SwipeAction
  alias Snack.Repo

  @rounds 5

  setup do
    :ok = Sandbox.checkout(Repo, sandbox: false)

    pairs =
      for _round <- 1..@rounds do
        {profile_fixture(user_fixture()), profile_fixture(user_fixture())}
      end

    profile_ids = Enum.flat_map(pairs, fn {a, b} -> [a.id, b.id] end)
    user_ids = Enum.flat_map(pairs, fn {a, b} -> [a.user_id, b.user_id] end)

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      # Swipes, matches, conversations and messages cascade from profiles.
      Repo.delete_all(from(p in Profile, where: p.id in ^profile_ids))
      Repo.delete_all(from(u in User, where: u.id in ^user_ids))
      Sandbox.checkin(Repo)
    end)

    %{pairs: pairs}
  end

  test "two simultaneous likes always create exactly one match", %{pairs: pairs} do
    for {a, b} <- pairs do
      results = like_simultaneously(a, b)

      assert Enum.all?(results, &match?({:ok, %{swipe: %SwipeAction{action_type: "like"}}}, &1))
      assert [%Match{} = match] = for({:ok, %{match: %Match{} = m}} <- results, do: m)

      assert [%Match{id: stored_id, status: "active"}] = matches_between(a, b)
      assert stored_id == match.id
      assert Repo.exists?(from(c in Conversation, where: c.match_id == ^match.id))
    end
  end

  test "the database rejects a second match for the same pair", %{pairs: [{a, b} | _]} do
    {:ok, %{match: nil}} = like(a, b)
    {:ok, %{match: %Match{}}} = like(b, a)

    # Reversed order on purpose: the unique index ignores the order of the pair.
    assert {:error, changeset} =
             %Match{}
             |> Match.changeset(%{
               profile_a_id: b.id,
               profile_b_id: a.id,
               status: "active",
               matched_at: DateTime.utc_now()
             })
             |> Repo.insert()

    assert {"has already been taken", _opts} = changeset.errors[:profile_a_id]
    assert length(matches_between(a, b)) == 1
  end

  # Holds FOR UPDATE on both profiles so each like blocks *inside* its own
  # transaction (on the pair lock, or on the foreign-key check of its swipe
  # insert), waits until both are blocked in PostgreSQL and releases them at once.
  defp like_simultaneously(a, b) do
    {:ok, tasks} =
      Repo.transaction(fn ->
        Repo.all(from(p in Profile, where: p.id in ^[a.id, b.id], lock: "FOR UPDATE"))

        tasks = [
          Task.async(fn -> like_on_own_connection(a, b) end),
          Task.async(fn -> like_on_own_connection(b, a) end)
        ]

        wait_until_blocked(2)
        tasks
      end)

    Task.await_many(tasks, 15_000)
  end

  defp like_on_own_connection(actor, target) do
    :ok = Sandbox.checkout(Repo, sandbox: false)

    try do
      like(actor, target)
    after
      Sandbox.checkin(Repo)
    end
  end

  defp like(actor, target) do
    Dating.record_swipe(%{
      actor_profile_id: actor.id,
      target_profile_id: target.id,
      action_type: "like"
    })
  end

  defp wait_until_blocked(expected, attempts \\ 500) do
    %{rows: [[blocked]]} =
      Repo.query!("""
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()
      """)

    cond do
      blocked >= expected ->
        :ok

      attempts == 0 ->
        flunk("the two likes never ran concurrently (#{blocked} blocked transactions)")

      true ->
        Process.sleep(10)
        wait_until_blocked(expected, attempts - 1)
    end
  end

  defp matches_between(a, b) do
    Repo.all(
      from(m in Match,
        where:
          (m.profile_a_id == ^a.id and m.profile_b_id == ^b.id) or
            (m.profile_a_id == ^b.id and m.profile_b_id == ^a.id)
      )
    )
  end
end
