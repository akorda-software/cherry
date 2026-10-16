defmodule Cherry.Dating.MatchExpiryBatchTest do
  use Cherry.DataCase, async: true

  import Ecto.Query
  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Cherry.Dating.{Match, MatchExpiry, MatchExpirySweeper}

  setup do
    viewer = profile_fixture(user_fixture())

    matches =
      for _ <- 1..5 do
        other = profile_fixture(user_fixture())
        {match, _conversation} = mutual_match!(viewer, other)
        expire_match!(match)
        match
      end

    %{matches: matches}
  end

  test "each batch is bounded and repeated batches converge", %{matches: matches} do
    assert MatchExpiry.expire_batch(DateTime.utc_now(), 2) == 2
    assert expired_count(matches) == 2
    assert MatchExpiry.expire_batch(DateTime.utc_now(), 2) == 2
    assert MatchExpiry.expire_batch(DateTime.utc_now(), 2) == 1
    assert MatchExpiry.expire_batch(DateTime.utc_now(), 2) == 0
    assert expired_count(matches) == 5
  end

  test "a message, future expiry and inactive status exclude matches", %{matches: [a, b, c | _]} do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    Repo.update_all(from(m in Match, where: m.id == ^a.id), set: [first_message_at: now])

    Repo.update_all(from(m in Match, where: m.id == ^b.id),
      set: [expires_at: DateTime.add(now, 1, :hour)]
    )

    Repo.update_all(from(m in Match, where: m.id == ^c.id), set: [status: "unmatched"])
    assert MatchExpiry.expire_batch(now, 100) == 2
    assert Repo.get!(Match, a.id).status == "active"
    assert Repo.get!(Match, b.id).status == "active"
    assert Repo.get!(Match, c.id).status == "unmatched"
  end

  test "the sweeper drains a backlog in bounded ticks rather than waiting an hour", ctx do
    {:ok, pid} =
      start_supervised(
        {MatchExpirySweeper,
         name: {:global, {__MODULE__, self()}},
         enabled: true,
         batch_size: 2,
         drain_delay_ms: 10,
         initial_delay_ms: 60_000,
         interval_ms: 3_600_000}
      )

    Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid)
    send(pid, :sweep)
    assert :sys.get_state(pid).batch_size == 2
    await_expired(ctx.matches, 5)
  end

  test "invalid batch sizes fail before accessing the database" do
    for size <- [0, -1, 1001, nil, "2"] do
      assert_raise ArgumentError, fn -> MatchExpiry.expire_batch(DateTime.utc_now(), size) end
    end
  end

  defp expired_count(matches) do
    ids = Enum.map(matches, & &1.id)
    Repo.aggregate(from(m in Match, where: m.id in ^ids and m.status == "expired"), :count)
  end

  defp await_expired(matches, count, attempts \\ 100) do
    if expired_count(matches) != count do
      assert attempts > 0, "expiry sweeper did not drain the backlog"
      Process.sleep(10)
      await_expired(matches, count, attempts - 1)
    end
  end
end
