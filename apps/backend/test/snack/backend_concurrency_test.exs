defmodule Snack.BackendConcurrencyTest do
  use ExUnit.Case, async: false

  import Ecto.Query
  import Snack.TestSupport.DatingFixtures

  alias Ecto.Adapters.SQL.Sandbox
  alias Snack.Accounts.User
  alias Snack.Dating
  alias Snack.Dating.{Conversation, Match, Profile, ProfilePhotoUploadIntent}
  alias Snack.Repo
  alias Snack.Sessions
  alias Snack.Sessions.{RefreshToken, SessionFamily}
  alias Snack.TestSupport.ConcurrentDB

  setup do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    user = user_fixture()
    profile = profile_fixture(user)
    other_user = user_fixture()
    other = profile_fixture(other_user)
    previous_storage = Application.get_env(:snack, Snack.Storage)
    Application.put_env(:snack, Snack.Storage, adapter: Snack.Storage.Local)

    on_exit(fn ->
      Application.put_env(:snack, Snack.Storage, previous_storage)
      :ok = Sandbox.checkout(Repo, sandbox: false)
      Repo.delete_all(from p in Profile, where: p.id in ^[profile.id, other.id])
      Repo.delete_all(from u in User, where: u.id in ^[user.id, other_user.id])
      Sandbox.checkin(Repo)
    end)

    %{user: user, profile: profile, other: other}
  end

  test "logout racing with refresh leaves no active replacement tokens", %{user: user} do
    for _ <- 1..5 do
      {:ok, issued} = Sessions.issue_session(user, device_attrs())
      family_id = issued.session_family.id

      results =
        ConcurrentDB.race(
          from(s in SessionFamily, where: s.id == ^family_id, lock: "FOR UPDATE"),
          [
            fn -> Sessions.refresh_session(issued.session.refresh_token) end,
            fn -> Sessions.revoke_session(issued.session.refresh_token) end
          ]
        )

      assert :ok in results
      assert Enum.any?(results, &(match?({:ok, _}, &1) or &1 == {:error, :session_revoked}))
      assert Repo.get!(SessionFamily, family_id).revoked_at

      refute Repo.exists?(
               from(t in RefreshToken,
                 where: t.session_family_id == ^family_id and t.status == "active"
               )
             )
    end
  end

  test "a message racing with a block is serialized and later sends are denied", %{
    profile: a,
    other: b
  } do
    {:ok, %{match: nil}} =
      Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})

    {:ok, %{match: match}} =
      Dating.record_swipe(%{actor_profile_id: b.id, target_profile_id: a.id, action_type: "like"})

    conversation = Repo.get_by!(Conversation, match_id: match.id)
    attrs = %{conversation_id: conversation.id, sender_profile_id: a.id, body: "Hello"}

    results =
      ConcurrentDB.race(
        from(m in Match, where: m.id == ^match.id, lock: "FOR UPDATE"),
        [
          fn -> Dating.send_message(attrs) end,
          fn -> Dating.block_profile(%{actor_profile_id: b.id, target_profile_id: a.id}) end
        ]
      )

    assert Enum.any?(results, &match?({:ok, %Dating.UserBlock{}}, &1))

    assert Enum.any?(
             results,
             &(match?({:ok, %Dating.Message{}}, &1) or &1 == {:error, :conversation_not_active})
           )

    assert {:error, :conversation_not_active} = Dating.send_message(attrs)
    refute Dating.conversation_allows_messaging?(conversation.id, a.id)
    refute Dating.conversation_allows_messaging?(conversation.id, b.id)
  end

  test "simultaneous refreshes rotate once and revoke the reused family", %{user: user} do
    {:ok, issued} = Sessions.issue_session(user, device_attrs())
    token = Repo.get_by!(RefreshToken, session_family_id: issued.session_family.id)
    refresh = fn -> Sessions.refresh_session(issued.session.refresh_token) end

    results =
      ConcurrentDB.race(from(t in RefreshToken, where: t.id == ^token.id, lock: "FOR UPDATE"), [
        refresh,
        refresh
      ])

    assert Enum.count(results, &match?({:ok, _}, &1)) == 1
    assert {:error, :refresh_token_reused} in results
    assert Repo.get!(SessionFamily, issued.session_family.id).revoked_at

    assert Repo.aggregate(from(t in RefreshToken, where: t.parent_token_id == ^token.id), :count) ==
             1

    refute Repo.exists?(
             from(t in RefreshToken,
               where: t.session_family_id == ^issued.session_family.id and t.status == "active"
             )
           )
  end

  test "simultaneous upload intents cannot exceed the live quota", %{profile: profile} do
    for _ <- 1..3,
        do: assert({:ok, _} = Dating.create_photo_upload_intent(profile, upload_attrs()))

    upload = fn -> Dating.create_photo_upload_intent(profile, upload_attrs()) end

    results = ConcurrentDB.race(profile_lock(profile), [upload, upload])

    assert Enum.count(results, &match?({:ok, _}, &1)) == 1
    assert {:error, :too_many_upload_intents} in results

    assert Repo.aggregate(
             from(i in ProfilePhotoUploadIntent, where: i.profile_id == ^profile.id),
             :count
           ) == 4
  end

  test "simultaneous upload intents cannot exceed the hourly quota", %{profile: profile} do
    expired_at = DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:second)

    for _ <- 1..19 do
      assert {:ok, _} = Dating.create_photo_upload_intent(profile, upload_attrs())

      Repo.update_all(from(i in ProfilePhotoUploadIntent, where: i.profile_id == ^profile.id),
        set: [expires_at: expired_at]
      )
    end

    upload = fn -> Dating.create_photo_upload_intent(profile, upload_attrs()) end
    results = ConcurrentDB.race(profile_lock(profile), [upload, upload])

    assert Enum.count(results, &match?({:ok, _}, &1)) == 1
    assert {:error, :upload_rate_limited} in results

    assert Repo.aggregate(
             from(i in ProfilePhotoUploadIntent, where: i.profile_id == ^profile.id),
             :count
           ) == 20
  end

  test "simultaneous first locations respect the privacy throttle", %{profile: profile} do
    recorded_at = DateTime.utc_now()

    operations =
      for {latitude, longitude} <- [{40.4168, -3.7038}, {41.3874, 2.1686}] do
        fn ->
          Dating.update_client_location(profile.id, %{
            latitude: latitude,
            longitude: longitude,
            recorded_at: recorded_at
          })
        end
      end

    results = ConcurrentDB.race(profile_lock(profile), operations)

    assert [{:ok, first}, {:ok, second}] = results
    assert first.coordinates == second.coordinates
    assert Dating.get_location(profile.id).coordinates == first.coordinates
  end

  defp profile_lock(profile),
    do: from(p in Profile, where: p.id == ^profile.id, lock: "FOR UPDATE")

  defp upload_attrs, do: %{position: 1, content_type: "image/jpeg", size_bytes: 100}

  defp device_attrs,
    do: %{installation_id: Ecto.UUID.generate(), platform: "ios", device_name: "Concurrency test"}
end
