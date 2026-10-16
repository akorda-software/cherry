defmodule Cherry.Dating.MatchExpiryConcurrencyTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Ecto.Adapters.SQL.Sandbox
  alias Cherry.Accounts.User
  alias Cherry.Dating.{Match, MatchExpiry, Profile}
  alias Cherry.Repo

  test "a busy match is skipped without holding up the rest of the expiry batch" do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    profiles = for _ <- 1..4, do: profile_fixture(user_fixture())
    [viewer | others] = profiles

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      ids = Enum.map(profiles, & &1.id)
      user_ids = Enum.map(profiles, & &1.user_id)
      Repo.delete_all(from(p in Profile, where: p.id in ^ids))
      Repo.delete_all(from(u in User, where: u.id in ^user_ids))
      Sandbox.checkin(Repo)
    end)

    matches =
      Enum.map(others, fn other ->
        {match, _conversation} = mutual_match!(viewer, other)
        expire_match!(match)
        match
      end)

    [busy | _] = matches

    assert {:ok, 2} =
             Repo.transaction(fn ->
               Repo.one!(from(m in Match, where: m.id == ^busy.id, lock: "FOR UPDATE"))

               task =
                 Task.async(fn ->
                   :ok = Sandbox.checkout(Repo, sandbox: false)

                   try do
                     MatchExpiry.expire_batch(DateTime.utc_now(), 2)
                   after
                     Sandbox.checkin(Repo)
                   end
                 end)

               # Await while still holding the row lock: a blocking UPDATE would
               # time out here instead of expiring the other two matches.
               count = Task.await(task, 2000)
               assert Repo.get!(Match, busy.id).status == "active"
               count
             end)

    assert MatchExpiry.expire_batch(DateTime.utc_now(), 2) == 1
    assert Repo.get!(Match, busy.id).status == "expired"
  end
end
