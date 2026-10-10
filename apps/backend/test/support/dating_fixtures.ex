defmodule Cherry.TestSupport.DatingFixtures do
  @moduledoc """
  Fixtures for dating domain tests.
  """

  alias Cherry.Accounts
  alias Cherry.Dating
  alias Cherry.Repo
  alias Cherry.Sessions

  def user_fixture(attrs \\ %{}) do
    {:ok, user} =
      Accounts.create_user(
        Map.merge(
          %{email: "user#{System.unique_integer()}@example.com", display_name: "User"},
          attrs
        )
      )

    user
  end

  def profile_fixture(user, attrs \\ %{}) do
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

  def complete_profile_fixture(user, attrs \\ %{}) do
    profile = profile_fixture(user, attrs)

    # Create discovery preferences
    Dating.upsert_discovery_preference(profile.id, %{
      age_min: 18,
      age_max: 40,
      distance_km: 25,
      show_men: true,
      show_women: true,
      show_non_binary: false
    })

    # Create location
    Dating.upsert_location(%{
      profile_id: profile.id,
      coordinates: %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326},
      recorded_at: DateTime.utc_now()
    })

    # Create photos
    for i <- 1..2 do
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: "photo#{i}",
        url: "https://example.com/photo#{i}.jpg",
        position: i,
        is_active: true
      })
    end

    # Add tags
    tags = ensure_tags(3)
    Dating.set_profile_tags(profile.id, Enum.map(tags, & &1.id))

    # Mark complete
    Dating.set_profile_complete(profile)
    Repo.get!(Cherry.Dating.Profile, profile.id)
  end

  def tag_fixture(attrs \\ %{}) do
    {:ok, tag} =
      Dating.create_tag(
        Map.merge(%{slug: "tag#{System.unique_integer()}", label: "Tag", category: "test"}, attrs)
      )

    tag
  end

  defp ensure_tags(count) do
    case Dating.list_active_tags() |> Enum.take(count) do
      [] -> for _ <- 1..count, do: tag_fixture()
      tags -> tags
    end
  end

  def authed_conn_for_user(user) do
    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: "test-install-#{System.unique_integer()}",
        platform: "ios",
        device_name: "Test Device"
      })

    Phoenix.ConnTest.build_conn()
    |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")
  end
end
