# Synthetic fixtures only, inside a rolled-back sandbox. Requires an empty,
# verified local *_test database. Check for other clients before starting Mix
# (after startup this application's own pool also has idle connections).
import Cherry.TestSupport.DatingFixtures
import Cherry.TestSupport.SocialFixtures

alias Cherry.Dating.{Inbox, Messaging, Profile, Social}
alias Cherry.Repo
alias Ecto.Adapters.SQL.Sandbox

unless Mix.env() == :test and Repo.config()[:pool] == Sandbox and
         Repo.config()[:hostname] in ["localhost", "127.0.0.1", "::1"] do
  raise "this probe requires MIX_ENV=test, SQL sandbox and a local database"
end

:ok = Sandbox.checkout(Repo)

try do
  [[database]] = Repo.query!("SELECT current_database()").rows
  unless String.contains?(database, "_test"), do: raise("refusing a non-test database")

  [[0]] = Repo.query!("SELECT count(*) FROM users").rows

  make_profile = fn ->
    profile_fixture(user_fixture())
    |> Ecto.Changeset.change(is_complete: true)
    |> Repo.update!()
  end

  viewer = make_profile.()

  for _ <- 1..100, do: like!(make_profile.(), viewer)
  for _ <- 1..20, do: mutual_match!(viewer, make_profile.())

  conversations =
    for _ <- 1..20 do
      other = make_profile.()
      {_match, conversation} = mutual_match!(viewer, other)

      for n <- 1..50 do
        insert_message!(conversation, other, "Synthetic benchmark message", seconds_ago(100 - n))
      end

      conversation
    end

  conversation = hd(conversations)

  variants = [
    summary_before: fn ->
      counts = Inbox.counts(viewer.id)
      Map.put(counts, :received_likes_count, Social.received_likes_count(viewer))
    end,
    summary_after: fn -> Social.activity_summary(viewer) end,
    permission_before: fn ->
      match?({:ok, _}, Messaging.get_messageable_conversation(conversation.id, viewer.id))
    end,
    permission_after: fn ->
      Messaging.conversation_allows_messaging?(conversation.id, viewer.id)
    end
  ]

  expected = %{received_likes_count: 100, new_matches_count: 20, unread_conversations_count: 20}
  true = variants[:summary_before].() == expected
  true = variants[:summary_after].() == expected
  true = variants[:permission_before].()
  true = variants[:permission_after].()

  for _ <- 1..3, {_name, fun} <- variants, do: fun.()

  samples =
    for _ <- 1..31, {name, fun} <- variants do
      {microseconds, _result} = :timer.tc(fun)
      {name, microseconds}
    end

  IO.puts("141 synthetic profiles, 100 pending likes, 40 matches, 1,000 messages")
  IO.puts("31 alternating samples after 3 warmups; context wall time, not a production SLA")

  for {name, values} <- Enum.group_by(samples, &elem(&1, 0), &elem(&1, 1)) do
    IO.inspect(Enum.at(Enum.sort(values), 15), label: "#{name} median_us")
  end

  # The synthetic population remains invisible outside this sandbox transaction.
  true = Repo.aggregate(Profile, :count) == 141
after
  Sandbox.checkin(Repo)
end
