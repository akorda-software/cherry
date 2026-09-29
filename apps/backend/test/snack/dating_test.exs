defmodule Snack.DatingTest do
  use Snack.DataCase, async: true

  alias Snack.Dating
  alias Snack.Repo

  # ── Profiles ──────────────────────────────────────────────────────────

  describe "create_profile/1" do
    test "creates a profile" do
      user = user_fixture()

      assert {:ok, profile} =
               Dating.create_profile(%{
                 user_id: user.id,
                 display_name: "Test User",
                 birth_date: ~D[1995-01-15],
                 gender: "man",
                 what_i_am_looking_for: "relationship",
                 bio: "This is a test bio that is long enough."
               })

      assert profile.display_name == "Test User"
      assert profile.gender == "man"
    end
  end

  describe "update_profile/2" do
    test "updates fields" do
      user = user_fixture()
      profile = profile_fixture(user)

      assert {:ok, updated} = Dating.update_profile(profile, %{display_name: "Updated"})
      assert updated.display_name == "Updated"
    end
  end

  describe "profile_complete?/1" do
    test "returns false for incomplete profiles" do
      user = user_fixture()
      profile = profile_fixture(user)
      refute Dating.profile_complete?(profile)
    end

    test "returns true when profile has all required fields" do
      user = user_fixture()
      profile = complete_profile_fixture(user)
      assert Dating.profile_complete?(profile)
    end
  end

  describe "pause_profile/1 and unpause_profile/1" do
    test "pause sets is_paused and disables discoverability" do
      user = user_fixture()
      profile = profile_fixture(user, %{is_discoverable: true})

      assert {:ok, paused} = Dating.pause_profile(profile)
      assert paused.is_paused == true
      assert paused.is_discoverable == false
    end

    test "unpause sets is_paused false" do
      user = user_fixture()
      profile = profile_fixture(user, %{is_paused: true})

      assert {:ok, unpaused} = Dating.unpause_profile(profile)
      assert unpaused.is_paused == false
    end
  end

  describe "delete_profile/1" do
    test "soft deletes a profile" do
      user = user_fixture()
      profile = profile_fixture(user)

      assert {:ok, deleted} = Dating.delete_profile(profile)
      assert deleted.deleted_at != nil
      assert deleted.is_discoverable == false
    end
  end

  # ── Discovery Preferences ─────────────────────────────────────────────

  describe "upsert_discovery_preference/2" do
    test "creates and updates discovery preferences" do
      user = user_fixture()
      profile = profile_fixture(user)

      assert {:ok, pref} =
               Dating.upsert_discovery_preference(profile.id, %{
                 age_min: 18,
                 age_max: 35,
                 distance_km: 10,
                 show_men: true,
                 show_women: false,
                 show_non_binary: false
               })

      assert pref.age_min == 18

      assert {:ok, updated} =
               Dating.upsert_discovery_preference(profile.id, %{
                 age_min: 20,
                 age_max: 40,
                 distance_km: 25,
                 show_men: true,
                 show_women: true,
                 show_non_binary: false
               })

      assert updated.age_min == 20
      assert updated.show_women == true
    end

    test "rejects when no interested-in option selected" do
      user = user_fixture()
      profile = profile_fixture(user)

      assert {:error, changeset} =
               Dating.upsert_discovery_preference(profile.id, %{
                 age_min: 18,
                 age_max: 35,
                 distance_km: 10,
                 show_men: false,
                 show_women: false,
                 show_non_binary: false
               })

      assert "select at least one option" in errors_on(changeset).show_men
    end
  end

  # ── Photos ────────────────────────────────────────────────────────────

  describe "create_photo/1" do
    test "creates a photo" do
      user = user_fixture()
      profile = profile_fixture(user)

      assert {:ok, photo} =
               Dating.create_photo(%{
                 profile_id: profile.id,
                 storage_key: "key1",
                 url: "https://example.com/1.jpg",
                 position: 1,
                 is_active: true
               })

      assert photo.storage_key == "key1"
      assert photo.is_active == true
    end
  end

  describe "list_photos/1" do
    test "returns active photos ordered by position" do
      user = user_fixture()
      profile = profile_fixture(user)

      {:ok, p1} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "k1",
          url: "https://example.com/1.jpg",
          position: 2,
          is_active: true
        })

      {:ok, p2} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "k2",
          url: "https://example.com/2.jpg",
          position: 1,
          is_active: true
        })

      {:ok, _p3} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "k3",
          url: "https://example.com/3.jpg",
          position: 3,
          is_active: false
        })

      photos = Dating.list_photos(profile.id)
      assert length(photos) == 2
      assert Enum.map(photos, & &1.id) == [p2.id, p1.id]
    end
  end

  describe "delete_photo/1" do
    test "soft deletes a photo" do
      user = user_fixture()
      profile = profile_fixture(user)

      {:ok, photo} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "k1",
          url: "https://example.com/1.jpg",
          position: 1,
          is_active: true
        })

      assert {:ok, deleted} = Dating.delete_photo(photo)
      assert deleted.is_active == false
      assert Dating.list_photos(profile.id) == []
    end
  end

  describe "reorder_photos/2" do
    test "reorders photos" do
      user = user_fixture()
      profile = profile_fixture(user)

      {:ok, p1} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "k1",
          url: "https://example.com/1.jpg",
          position: 1,
          is_active: true
        })

      {:ok, p2} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "k2",
          url: "https://example.com/2.jpg",
          position: 2,
          is_active: true
        })

      {:ok, p3} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "k3",
          url: "https://example.com/3.jpg",
          position: 3,
          is_active: true
        })

      assert {:ok, photos} = Dating.reorder_photos(profile.id, [p3.id, p1.id, p2.id])
      assert Enum.map(photos, & &1.id) == [p3.id, p1.id, p2.id]
      assert Enum.map(photos, & &1.position) == [1, 2, 3]
    end
  end

  # ── Tags ──────────────────────────────────────────────────────────────

  describe "list_active_tags/0" do
    test "returns active tags" do
      active = tag_fixture(%{is_active: true})
      _inactive = tag_fixture(%{is_active: false})

      tags = Dating.list_active_tags()
      assert active.id in Enum.map(tags, & &1.id)
      refute _inactive.id in Enum.map(tags, & &1.id)
    end
  end

  describe "set_profile_tags/2" do
    test "sets up to 8 tags" do
      user = user_fixture()
      profile = profile_fixture(user)
      tags = for _ <- 1..3, do: tag_fixture()
      tag_ids = Enum.map(tags, & &1.id)

      assert {:ok, updated} = Dating.set_profile_tags(profile.id, tag_ids)
      assert length(updated.tags) == 3
    end

    test "rejects more than 8 tags" do
      user = user_fixture()
      profile = profile_fixture(user)
      tags = for _ <- 1..9, do: tag_fixture()
      tag_ids = Enum.map(tags, & &1.id)

      assert {:error, :too_many_tags} = Dating.set_profile_tags(profile.id, tag_ids)
    end
  end

  describe "set_profile_blocked_tags/2" do
    test "sets up to 5 blocked tags" do
      user = user_fixture()
      profile = profile_fixture(user)
      tags = for _ <- 1..4, do: tag_fixture()
      tag_ids = Enum.map(tags, & &1.id)

      assert {:ok, updated} = Dating.set_profile_blocked_tags(profile.id, tag_ids)
      assert length(updated.blocked_tags) == 4
    end

    test "rejects more than 5 blocked tags" do
      user = user_fixture()
      profile = profile_fixture(user)
      tags = for _ <- 1..6, do: tag_fixture()
      tag_ids = Enum.map(tags, & &1.id)

      assert {:error, :too_many_blocked_tags} =
               Dating.set_profile_blocked_tags(profile.id, tag_ids)
    end
  end

  describe "get_profile_tags/1 and get_profile_blocked_tags/1" do
    test "return correct tags" do
      user = user_fixture()
      profile = profile_fixture(user)
      t1 = tag_fixture()
      t2 = tag_fixture()
      t3 = tag_fixture()

      {:ok, _} = Dating.set_profile_tags(profile.id, [t1.id, t2.id])
      {:ok, _} = Dating.set_profile_blocked_tags(profile.id, [t3.id])

      assert Enum.map(Dating.get_profile_tags(profile.id), & &1.id) |> Enum.sort() ==
               [t1.id, t2.id] |> Enum.sort()

      assert Enum.map(Dating.get_profile_blocked_tags(profile.id), & &1.id) == [t3.id]
    end
  end

  # ── Location ──────────────────────────────────────────────────────────

  describe "upsert_location/1" do
    test "creates and updates location" do
      user = user_fixture()
      profile = profile_fixture(user)

      assert {:ok, loc} =
               Dating.upsert_location(%{
                 profile_id: profile.id,
                 coordinates: %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326},
                 recorded_at: DateTime.utc_now()
               })

      assert loc.coordinates == %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326}

      assert {:ok, updated} =
               Dating.upsert_location(%{
                 profile_id: profile.id,
                 coordinates: %Geo.Point{coordinates: {-4.0, 41.0}, srid: 4326},
                 recorded_at: DateTime.utc_now()
               })

      assert updated.coordinates == %Geo.Point{coordinates: {-4.0, 41.0}, srid: 4326}
    end
  end

  describe "get_location/1" do
    test "returns the location" do
      user = user_fixture()
      profile = profile_fixture(user)

      {:ok, loc} =
        Dating.upsert_location(%{
          profile_id: profile.id,
          coordinates: %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326},
          recorded_at: DateTime.utc_now()
        })

      assert Dating.get_location(profile.id).profile_id == loc.profile_id
    end
  end

  # ── Swipe & Match ─────────────────────────────────────────────────────

  describe "record_swipe/1" do
    test "creates a like" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      assert {:ok, %{swipe: swipe, match: nil}} =
               Dating.record_swipe(%{
                 actor_profile_id: a.id,
                 target_profile_id: b.id,
                 action_type: "like"
               })

      assert swipe.action_type == "like"
    end

    test "creates a match on mutual like" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      assert {:ok, %{match: nil}} =
               Dating.record_swipe(%{
                 actor_profile_id: a.id,
                 target_profile_id: b.id,
                 action_type: "like"
               })

      assert {:ok, %{swipe: _swipe, match: %Snack.Dating.Match{} = match}} =
               Dating.record_swipe(%{
                 actor_profile_id: b.id,
                 target_profile_id: a.id,
                 action_type: "like"
               })

      assert match.status == "active"
      assert match.expires_at != nil
    end

    test "does NOT create a match if only one-sided" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      assert {:ok, %{match: nil}} =
               Dating.record_swipe(%{
                 actor_profile_id: a.id,
                 target_profile_id: b.id,
                 action_type: "like"
               })

      assert Dating.list_matches(a.id) == []
      assert Dating.list_matches(b.id) == []
    end
  end

  describe "list_matches/1" do
    test "returns active matches for a profile" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})
      Dating.record_swipe(%{actor_profile_id: b.id, target_profile_id: a.id, action_type: "like"})

      assert length(Dating.list_matches(a.id)) == 1
      assert length(Dating.list_matches(b.id)) == 1
    end
  end

  describe "unmatch/1" do
    test "changes status to unmatched" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})

      {:ok, %{match: match}} =
        Dating.record_swipe(%{
          actor_profile_id: b.id,
          target_profile_id: a.id,
          action_type: "like"
        })

      assert {:ok, updated} = Dating.unmatch(match.id)
      assert updated.status == "unmatched"
      assert updated.unmatched_at != nil
    end
  end

  # ── Chat ──────────────────────────────────────────────────────────────

  describe "send_message/1" do
    test "creates a message" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})

      {:ok, %{match: match}} =
        Dating.record_swipe(%{
          actor_profile_id: b.id,
          target_profile_id: a.id,
          action_type: "like"
        })

      conversation = Repo.get_by!(Snack.Dating.Conversation, match_id: match.id)

      assert {:ok, message} =
               Dating.send_message(%{
                 conversation_id: conversation.id,
                 sender_profile_id: a.id,
                 body: "Hello!"
               })

      assert message.body == "Hello!"
    end

    test "stores body encrypted at rest and returns it in clear text on read" do
      %{conversation: conversation, sender: sender} = conversation_fixture()

      assert {:ok, message} =
               Dating.send_message(%{
                 conversation_id: conversation.id,
                 sender_profile_id: sender.id,
                 body: "plaintext secret"
               })

      assert message.body == "plaintext secret"

      stored_body =
        Ecto.Query.from(m in "messages",
          where: m.id == type(^message.id, :binary_id),
          select: m.body
        )
        |> Repo.one()

      refute String.contains?(stored_body, "plaintext secret")
      assert Snack.Crypto.encrypted?(stored_body)

      assert %{body: "plaintext secret"} = Repo.reload!(message)
    end

    test "reads legacy plaintext rows transparently" do
      %{conversation: conversation, sender: sender} = conversation_fixture()

      {:ok, message} =
        Dating.send_message(%{
          conversation_id: conversation.id,
          sender_profile_id: sender.id,
          body: "mensaje nuevo"
        })

      Ecto.Query.from(m in "messages", where: m.id == type(^message.id, :binary_id))
      |> Repo.update_all(set: [body: "fila antigua en claro"])

      assert [%{body: "fila antigua en claro"}] = Dating.list_messages(conversation.id)
    end

    test "on first message clears match expires_at and sets first_message_at" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})

      {:ok, %{match: match}} =
        Dating.record_swipe(%{
          actor_profile_id: b.id,
          target_profile_id: a.id,
          action_type: "like"
        })

      assert match.expires_at != nil
      assert match.first_message_at == nil

      conversation = Repo.get_by!(Snack.Dating.Conversation, match_id: match.id)

      {:ok, _} =
        Dating.send_message(%{
          conversation_id: conversation.id,
          sender_profile_id: a.id,
          body: "First message"
        })

      refreshed = Repo.get!(Snack.Dating.Match, match.id)
      assert refreshed.first_message_at != nil
      assert refreshed.expires_at == nil
    end
  end

  describe "list_messages/2" do
    test "paginates messages" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})

      {:ok, %{match: match}} =
        Dating.record_swipe(%{
          actor_profile_id: b.id,
          target_profile_id: a.id,
          action_type: "like"
        })

      conversation = Repo.get_by!(Snack.Dating.Conversation, match_id: match.id)

      now = DateTime.utc_now()

      for i <- 1..3 do
        at = DateTime.add(now, -i, :second)

        %Snack.Dating.Message{}
        |> Ecto.Changeset.change(%{
          conversation_id: conversation.id,
          sender_profile_id: a.id,
          body: "Message #{i}",
          inserted_at: at,
          updated_at: at
        })
        |> Repo.insert!()
      end

      page1 = Dating.list_messages(conversation.id, limit: 2)
      assert length(page1) == 2

      [last_msg | _] = Enum.reverse(page1)
      page2 = Dating.list_messages(conversation.id, limit: 2, cursor: last_msg.inserted_at)
      assert length(page2) == 1
    end
  end

  describe "list_conversations/1" do
    test "returns conversations" do
      a = profile_fixture(user_fixture())
      b = profile_fixture(user_fixture())

      Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})
      Dating.record_swipe(%{actor_profile_id: b.id, target_profile_id: a.id, action_type: "like"})

      conversations = Dating.list_conversations(a.id)
      assert length(conversations) == 1
      assert hd(conversations).match_id != nil
    end
  end

  # ── Safety ────────────────────────────────────────────────────────────

  describe "block_profile/1" do
    test "creates a block" do
      actor = profile_fixture(user_fixture())
      target = profile_fixture(user_fixture())

      assert {:ok, block} =
               Dating.block_profile(%{
                 actor_profile_id: actor.id,
                 target_profile_id: target.id,
                 reason: "spam"
               })

      assert block.actor_profile_id == actor.id
      assert block.target_profile_id == target.id
    end
  end

  describe "report_profile/1" do
    test "creates a report" do
      reporter = profile_fixture(user_fixture())
      target = profile_fixture(user_fixture())

      assert {:ok, report} =
               Dating.report_profile(%{
                 reporter_profile_id: reporter.id,
                 target_profile_id: target.id,
                 reason: "inappropriate",
                 details: "Details here"
               })

      assert report.reporter_profile_id == reporter.id
      assert report.status == "open"
    end
  end

  # ── Admin ─────────────────────────────────────────────────────────────

  describe "list_reports/1" do
    test "filters by status" do
      reporter = profile_fixture(user_fixture())
      target = profile_fixture(user_fixture())

      {:ok, r1} =
        Dating.report_profile(%{
          reporter_profile_id: reporter.id,
          target_profile_id: target.id,
          reason: "spam"
        })

      {:ok, r2} =
        Dating.report_profile(%{
          reporter_profile_id: reporter.id,
          target_profile_id: target.id,
          reason: "abuse"
        })

      {:ok, r3} =
        Dating.report_profile(%{
          reporter_profile_id: reporter.id,
          target_profile_id: target.id,
          reason: "other"
        })

      Dating.update_report(r3, %{status: "reviewed"})

      open_reports = Dating.list_reports("open")
      assert length(open_reports) == 2
      assert r1.id in Enum.map(open_reports, & &1.id)
      assert r2.id in Enum.map(open_reports, & &1.id)

      reviewed = Dating.list_reports("reviewed")
      assert length(reviewed) == 1
      assert hd(reviewed).id == r3.id
    end
  end

  describe "update_report/2" do
    test "updates a report" do
      reporter = profile_fixture(user_fixture())
      target = profile_fixture(user_fixture())

      {:ok, report} =
        Dating.report_profile(%{
          reporter_profile_id: reporter.id,
          target_profile_id: target.id,
          reason: "spam"
        })

      assert {:ok, updated} = Dating.update_report(report, %{status: "actioned"})
      assert updated.status == "actioned"
    end
  end

  describe "disable_profile/1" do
    test "disables a profile" do
      user = user_fixture()
      profile = profile_fixture(user, %{is_discoverable: true, is_paused: false})

      assert {:ok, disabled} = Dating.disable_profile(profile)
      assert disabled.is_discoverable == false
      assert disabled.is_paused == true
    end
  end

  # ── Helpers ───────────────────────────────────────────────────────────

  defp conversation_fixture do
    a = profile_fixture(user_fixture())
    b = profile_fixture(user_fixture())

    Dating.record_swipe(%{actor_profile_id: a.id, target_profile_id: b.id, action_type: "like"})

    {:ok, %{match: match}} =
      Dating.record_swipe(%{
        actor_profile_id: b.id,
        target_profile_id: a.id,
        action_type: "like"
      })

    conversation = Repo.get_by!(Snack.Dating.Conversation, match_id: match.id)

    %{a: a, b: b, match: match, conversation: conversation, sender: a}
  end

  defp user_fixture(attrs \\ %{}) do
    {:ok, user} =
      Snack.Accounts.create_user(
        Map.merge(
          %{email: "test#{System.unique_integer()}@example.com", display_name: "Test"},
          attrs
        )
      )

    user
  end

  defp profile_fixture(user, attrs \\ %{}) do
    {:ok, profile} =
      Dating.create_profile(
        Map.merge(
          %{
            user_id: user.id,
            display_name: "Test User",
            birth_date: ~D[1995-01-15],
            gender: "man",
            what_i_am_looking_for: "relationship",
            bio: "This is a test bio that is long enough to pass validation rules.",
            is_complete: false,
            is_discoverable: true
          },
          attrs
        )
      )

    profile
  end

  defp complete_profile_fixture(user, attrs \\ %{}) do
    profile = profile_fixture(user, attrs)

    Dating.upsert_discovery_preference(profile.id, %{
      age_min: 18,
      age_max: 40,
      distance_km: 25,
      show_men: true,
      show_women: true,
      show_non_binary: false
    })

    Dating.upsert_location(%{
      profile_id: profile.id,
      coordinates: %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326},
      recorded_at: DateTime.utc_now()
    })

    for i <- 1..2 do
      {:ok, _} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "photo#{i}",
          url: "https://example.com/photo#{i}.jpg",
          position: i,
          is_active: true
        })
    end

    t1 = tag_fixture()
    t2 = tag_fixture()
    Dating.set_profile_tags(profile.id, [t1.id, t2.id])

    {:ok, completed} = Dating.set_profile_complete(profile)
    completed
  end

  defp tag_fixture(attrs \\ %{}) do
    {:ok, tag} =
      Dating.create_tag(
        Map.merge(
          %{slug: "slug#{System.unique_integer()}", label: "Label", category: "test"},
          attrs
        )
      )

    tag
  end
end
