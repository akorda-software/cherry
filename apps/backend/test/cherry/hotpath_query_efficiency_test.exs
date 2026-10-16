defmodule Cherry.HotpathQueryEfficiencyTest do
  use Cherry.DataCase, async: true

  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Cherry.Dating
  alias Cherry.Dating.{Inbox, Match, Profile, Social}
  alias Cherry.Notifications
  alias Cherry.Sessions
  alias Cherry.Sessions.PushToken

  test "activity summary composes both badge aggregates in one statement" do
    viewer = complete_profile_fixture(user_fixture())
    pending = complete_profile_fixture(user_fixture())
    fresh = complete_profile_fixture(user_fixture())
    chatting = complete_profile_fixture(user_fixture())
    like!(pending, viewer)
    {_match, _conversation} = mutual_match!(viewer, fresh)
    {_match, conversation} = mutual_match!(viewer, chatting)
    insert_message!(conversation, chatting, "Unread", seconds_ago(5))

    {summary, queries} = queries(fn -> Social.activity_summary(viewer) end)

    assert summary == %{
             received_likes_count: 1,
             new_matches_count: 1,
             unread_conversations_count: 1
           }

    assert length(queries) == 1
    assert {:ok, _} = Inbox.mark_read(conversation.id, viewer.id)
    assert Social.activity_summary(viewer).unread_conversations_count == 0
  end

  test "summary retains empty, preferences, read and visibility rules" do
    viewer = complete_profile_fixture(user_fixture()) |> Repo.preload(:discovery_preference)
    empty = %{received_likes_count: 0, new_matches_count: 0, unread_conversations_count: 0}
    assert Social.activity_summary(viewer) == empty
    pending = complete_profile_fixture(user_fixture())
    like!(pending, viewer)
    Dating.upsert_discovery_preference(viewer.id, %{show_men: false})
    assert Social.activity_summary(viewer) == empty

    other = complete_profile_fixture(user_fixture())
    {match, conversation} = mutual_match!(viewer, other)
    assert Social.activity_summary(viewer).new_matches_count == 1
    assert {:ok, _} = Inbox.mark_read(conversation.id, viewer.id)
    assert Social.activity_summary(viewer) == empty
    insert_message!(conversation, other, "Hidden", DateTime.add(DateTime.utc_now(), 1, :second))
    assert Social.activity_summary(viewer).unread_conversations_count == 1
    expire_match!(match)
    assert Social.activity_summary(viewer) == empty
  end

  test "boolean chat permissions select one scalar instead of hydrating records" do
    a = profile_fixture(user_fixture())
    b = profile_fixture(user_fixture())
    {_match, conversation} = mutual_match!(a, b)

    {allowed, [{_sql, {:ok, result}}]} =
      queries(fn -> Dating.conversation_allows_messaging?(conversation.id, a.id) end)

    assert allowed
    assert length(result.columns) == 1
    assert length(hd(result.rows)) == 1
  end

  test "summary immediately excludes blocked pairs and deleted counterpart accounts" do
    viewer = complete_profile_fixture(user_fixture())
    pending = complete_profile_fixture(user_fixture())
    other = complete_profile_fixture(user_fixture())
    like!(pending, viewer)
    {_match, conversation} = mutual_match!(viewer, other)
    insert_message!(conversation, other, "Unread", seconds_ago(5))
    assert Social.activity_summary(viewer).received_likes_count == 1
    assert Social.activity_summary(viewer).unread_conversations_count == 1

    assert {:ok, _} =
             Dating.block_profile(%{actor_profile_id: pending.id, target_profile_id: viewer.id})

    Repo.get!(Cherry.Accounts.User, other.user_id)
    |> Ecto.Changeset.change(deleted_at: seconds_ago(1))
    |> Repo.update!()

    {summary, queries} = queries(fn -> Social.activity_summary(viewer) end)

    assert summary == %{
             received_likes_count: 0,
             new_matches_count: 0,
             unread_conversations_count: 0
           }

    assert length(queries) == 1
  end

  test "boolean chat permissions remain fresh and agree with detailed authorization" do
    a = profile_fixture(user_fixture())
    b = profile_fixture(user_fixture())
    stranger = profile_fixture(user_fixture())
    {match, conversation} = mutual_match!(a, b)

    for id <- [a.id, b.id, stranger.id, Ecto.UUID.generate(), nil, "invalid"] do
      assert Dating.conversation_allows_messaging?(conversation.id, id) ==
               match?({:ok, _}, Dating.get_messageable_conversation(conversation.id, id))
    end

    for {schema, id, changes} <- [
          {Match, match.id, [status: "unmatched"]},
          {Match, match.id, [expires_at: seconds_ago(1)]},
          {Match, match.id, [expires_at: seconds_ago(0)]},
          {Profile, a.id, [deleted_at: seconds_ago(1)]},
          {Profile, b.id, [deleted_at: seconds_ago(1)]},
          {Cherry.Accounts.User, a.user_id, [deleted_at: seconds_ago(1)]},
          {Cherry.Accounts.User, b.user_id, [deleted_at: seconds_ago(1)]}
        ] do
      record = Repo.get!(schema, id)
      record |> Ecto.Changeset.change(changes) |> Repo.update!()

      for participant <- [a, b] do
        refute Dating.conversation_allows_messaging?(conversation.id, participant.id)

        assert {:error, :conversation_not_active} =
                 Dating.get_messageable_conversation(conversation.id, participant.id)
      end

      original = Keyword.new(changes, fn {key, _} -> {key, Map.fetch!(record, key)} end)
      record |> Ecto.Changeset.change(original) |> Repo.update!()
    end

    assert {:ok, _} =
             Dating.block_profile(%{actor_profile_id: b.id, target_profile_id: a.id})

    refute Dating.conversation_allows_messaging?(conversation.id, a.id)
    refute Dating.conversation_allows_messaging?(conversation.id, b.id)
    refute Dating.conversation_allows_messaging?("invalid", a.id)
  end

  test "invalid push tickets deactivate all rejected tokens in one update" do
    user = user_fixture()
    profile = profile_fixture(user)
    rejected = for n <- 1..3, do: register_token(user, "DeviceNotRegistered-#{n}")
    valid = register_token(user, "valid")
    unrelated = register_token(user_fixture(), "DeviceNotRegistered-unrelated")
    Process.put(:expo_push_test_pid, self())

    {delivery, queries} =
      queries(fn -> Notifications.deliver_to_profile(profile, %{"title" => "Test"}) end)

    assert {:ok, %{sent: 1, invalidated: 3}} = delivery
    assert length(queries) == 2
    [{_select, {:ok, selected}}, {_update, _result}] = queries
    assert selected.columns == ["id", "expo_push_token"]
    assert_receive {:expo_push_messages, messages}
    assert length(messages) == 4

    for token <- rejected do
      assert %{status: "inactive", disabled_at: %DateTime{}} = Repo.get!(PushToken, token.id)
    end

    assert Repo.get!(PushToken, valid.id).status == "active"
    assert Repo.get!(PushToken, unrelated.id).status == "active"
  end

  test "successful push tickets need no write and no active tokens need no provider call" do
    user = user_fixture()
    profile = profile_fixture(user)
    Process.put(:expo_push_test_pid, self())

    {{:ok, %{sent: 0, invalidated: 0}}, queries} =
      queries(fn -> Notifications.deliver_to_profile(profile, %{"title" => "Test"}) end)

    assert length(queries) == 1
    refute_received {:expo_push_messages, _}
    register_token(user, "valid")

    {{:ok, %{sent: 1, invalidated: 0}}, queries} =
      queries(fn -> Notifications.deliver_to_profile(profile, %{"title" => "Test"}) end)

    assert length(queries) == 1
    assert_received {:expo_push_messages, [_]}
  end

  test "retryable tickets still invalidate unregistered devices before retrying" do
    user = user_fixture()
    profile = profile_fixture(user)
    tokens = for n <- 1..2, do: register_token(user, "mixed-#{n}")
    Process.put(:expo_push_test_pid, self())

    Process.put(:expo_push_test_result, {
      :ok,
      [
        %{"status" => "error", "details" => %{"error" => "DeviceNotRegistered"}},
        %{"status" => "error", "details" => %{"error" => "MessageRateExceeded"}}
      ]
    })

    assert {:error, :push_ticket_rejected} =
             Notifications.deliver_to_profile(profile, %{"title" => "Test"})

    assert_received {:expo_push_messages, [invalidated_message, valid_message]}
    by_token = Map.new(tokens, &{&1.expo_push_token, &1.id})
    assert Repo.get!(PushToken, by_token[invalidated_message["to"]]).status == "inactive"
    assert Repo.get!(PushToken, by_token[valid_message["to"]]).status == "active"
  end

  defp register_token(user, suffix) do
    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: suffix,
        platform: "ios",
        device_name: "Test device"
      })

    {:ok, token} =
      Sessions.register_push_token(user, issued.session_family.id, %{
        "expoPushToken" => "ExponentPushToken[#{suffix}]",
        "platform" => "ios",
        "installationId" => suffix
      })

    token
  end

  defp queries(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    :ok = :telemetry.attach(handler, [:cherry, :repo, :query], &__MODULE__.query/4, {self(), ref})

    try do
      {fun.(), collect_queries(ref)}
    after
      :telemetry.detach(handler)
    end
  end

  def query(_event, _measurements, metadata, {owner, ref}) do
    if self() == owner, do: send(owner, {ref, {metadata.query, metadata.result}})
  end

  defp collect_queries(ref) do
    receive do
      {^ref, query} -> [query | collect_queries(ref)]
    after
      0 -> []
    end
  end
end
