defmodule SnackWeb.Controllers.Api.ProfileControllerTest do
  use SnackWeb.ConnCase, async: false

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Dating.ProfilePhotoUploadIntent
  alias Snack.Repo
  alias Snack.Sessions

  setup do
    original_r2_config = Application.get_env(:snack, Snack.Storage.R2)
    Application.put_env(:snack, Snack.Storage.R2, r2_test_config())
    on_exit(fn -> Application.put_env(:snack, Snack.Storage.R2, original_r2_config) end)

    {:ok, user} =
      Accounts.create_user(%{email: "profile_ctrl@example.com", display_name: "Profile Ctrl"})

    {:ok, profile} =
      Dating.create_profile(%{
        user_id: user.id,
        display_name: "Test User",
        birth_date: ~D[1995-01-15],
        gender: "man",
        what_i_am_looking_for: "relationship",
        bio: "This is a test bio that is long enough to pass validation rules."
      })

    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: "profile-ctrl-install",
        platform: "ios",
        device_name: "Test Device"
      })

    authed_conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    %{user: user, profile: profile, authed_conn: authed_conn}
  end

  describe "GET /api/me/profile" do
    test "returns the current profile", %{authed_conn: conn, profile: profile} do
      conn = get(conn, "/api/me/profile")
      assert %{"profile" => %{"id" => id}} = json_response(conn, 200)
      assert id == profile.id
    end

    test "returns null profile for first-login users" do
      %{conn: conn} = authed_conn_without_profile()

      conn = get(conn, "/api/me/profile")

      assert %{"profile" => nil, "completeness" => false} = json_response(conn, 200)
    end

    test "returns 404 without auth", %{authed_conn: _conn} do
      conn = Phoenix.ConnTest.build_conn() |> get("/api/me/profile")
      assert conn.status == 401
    end
  end

  describe "PUT /api/me/profile" do
    test "updates profile fields", %{authed_conn: conn} do
      conn = put(conn, "/api/me/profile", %{"display_name" => "Updated Name"})
      assert %{"profile" => %{"displayName" => "Updated Name"}} = json_response(conn, 200)
    end

    test "creates a draft profile for first-login users" do
      %{conn: conn, user: user} = authed_conn_without_profile()

      conn = put(conn, "/api/me/profile", %{"display_name" => "Draft Name"})

      assert %{"profile" => %{"displayName" => "Draft Name", "isComplete" => false}} =
               json_response(conn, 200)

      assert Repo.get_by!(Dating.Profile, user_id: user.id).display_name == "Draft Name"
    end

    test "rejects invalid fields", %{authed_conn: conn} do
      conn = put(conn, "/api/me/profile", %{"bio" => "short"})
      assert conn.status == 422
    end
  end

  describe "POST /api/me/profile/complete" do
    test "returns missing onboarding requirements", %{authed_conn: conn} do
      conn = post(conn, "/api/me/profile/complete")

      assert conn.status == 422
      assert %{"error" => "profile_incomplete", "missing" => missing} = json_response(conn, 422)
      assert "photos" in missing
      assert "location" in missing
    end

    test "marks a valid profile complete and discoverable", %{authed_conn: conn, profile: profile} do
      complete_profile_requirements(profile)

      conn = post(conn, "/api/me/profile/complete")

      assert %{
               "profile" => %{"isComplete" => true, "isDiscoverable" => true},
               "onboardingRequired" => false
             } =
               json_response(conn, 200)
    end
  end

  describe "GET /api/me/discovery-preferences" do
    test "returns preferences when they exist", %{authed_conn: conn, profile: profile} do
      Dating.upsert_discovery_preference(profile.id, %{
        age_min: 18,
        age_max: 40,
        distance_km: 25,
        show_men: true,
        show_women: false,
        show_non_binary: false
      })

      conn = get(conn, "/api/me/discovery-preferences")
      assert %{"discoveryPreferences" => %{"distanceKm" => 25}} = json_response(conn, 200)
    end
  end

  describe "PUT /api/me/discovery-preferences" do
    test "creates preferences", %{authed_conn: conn} do
      conn =
        put(conn, "/api/me/discovery-preferences", %{
          "age_min" => 20,
          "age_max" => 35,
          "distance_km" => 50,
          "show_men" => true,
          "show_women" => true,
          "show_non_binary" => false
        })

      assert %{"discoveryPreferences" => %{"distanceKm" => 50}} = json_response(conn, 200)
    end
  end

  describe "POST /api/me/location" do
    test "updates location from latitude and longitude", %{authed_conn: conn, profile: profile} do
      conn =
        post(conn, "/api/me/location", %{
          "latitude" => 40.4168,
          "longitude" => -3.7038,
          "accuracyMeters" => 25,
          "recordedAt" => DateTime.to_iso8601(DateTime.utc_now())
        })

      assert json_response(conn, 200) == %{"ok" => true}

      location = Dating.get_location(profile.id)
      assert %Geo.Point{coordinates: {longitude, latitude}, srid: 4326} = location.coordinates
      assert abs(latitude - 40.4168) < 0.01
      assert abs(longitude - -3.7038) < 0.01
      refute latitude == 40.4168
      refute longitude == -3.7038
      assert location.accuracy_meters == 25
    end

    test "rejects invalid coordinates", %{authed_conn: conn} do
      conn =
        post(conn, "/api/me/location", %{
          "latitude" => 140.4168,
          "longitude" => -3.7038
        })

      assert conn.status == 422
    end
  end

  describe "POST /api/me/photos/upload-intent" do
    test "creates a signed R2 upload intent", %{authed_conn: conn, profile: profile} do
      conn =
        post(conn, "/api/me/photos/upload-intent", %{
          "position" => 1,
          "contentType" => "image/jpeg",
          "sizeBytes" => 420_000
        })

      assert %{
               "storageKey" => storage_key,
               "uploadUrl" => upload_url,
               "publicUrl" => public_url,
               "method" => "PUT",
               "headers" => %{"Content-Type" => "image/jpeg"},
               "maxBytes" => 2_000_000
             } = json_response(conn, 200)

      assert String.starts_with?(storage_key, "profiles/#{profile.id}/")
      assert String.ends_with?(storage_key, ".jpg")
      assert String.contains?(upload_url, "test-account.r2.cloudflarestorage.com/test-bucket/")
      assert String.contains?(upload_url, "X-Amz-Signature=")
      assert public_url == "https://cdn.example.test/#{storage_key}"

      intent = Repo.get_by!(ProfilePhotoUploadIntent, storage_key: storage_key)
      assert intent.profile_id == profile.id
      assert intent.position == 1
      assert intent.content_type == "image/jpeg"
      assert intent.size_bytes == 420_000
    end

    test "rejects unsupported content type", %{authed_conn: conn} do
      conn =
        post(conn, "/api/me/photos/upload-intent", %{
          "position" => 1,
          "contentType" => "image/gif",
          "sizeBytes" => 420_000
        })

      assert conn.status == 422
    end
  end

  describe "POST /api/me/photos/complete" do
    test "completes an upload intent and creates photo metadata", %{
      authed_conn: conn,
      profile: profile
    } do
      {:ok, upload} =
        Dating.create_photo_upload_intent(profile, %{
          position: 1,
          content_type: "image/jpeg",
          size_bytes: 420_000
        })

      conn =
        post(conn, "/api/me/photos/complete", %{
          "storageKey" => upload.storage_key,
          "publicUrl" => upload.public_url,
          "contentType" => "image/jpeg",
          "sizeBytes" => 420_000,
          "position" => 1
        })

      assert %{"photo" => %{"storageKey" => storage_key, "url" => public_url, "position" => 1}} =
               json_response(conn, 200)

      assert storage_key == upload.storage_key
      assert public_url == upload.public_url

      assert Repo.get_by!(Dating.ProfilePhoto, storage_key: upload.storage_key).profile_id ==
               profile.id

      assert Repo.get_by!(ProfilePhotoUploadIntent, storage_key: upload.storage_key).completed_at !=
               nil
    end

    test "rejects unknown upload intent", %{authed_conn: conn} do
      conn =
        post(conn, "/api/me/photos/complete", %{"storageKey" => "profiles/unknown/photo.jpg"})

      assert %{"error" => "upload_intent_not_found"} = json_response(conn, 404)
    end
  end

  describe "POST /api/me/pause" do
    test "pauses the profile", %{authed_conn: conn} do
      conn = post(conn, "/api/me/pause")
      assert json_response(conn, 200) == %{"ok" => true}
    end
  end

  describe "POST /api/me/unpause" do
    test "unpauses the profile", %{authed_conn: conn} do
      post(conn, "/api/me/pause")
      conn = post(conn, "/api/me/unpause")
      assert json_response(conn, 200) == %{"ok" => true}
    end
  end

  describe "DELETE /api/me/account" do
    test "soft deletes the profile", %{authed_conn: conn, profile: profile} do
      conn = delete(conn, "/api/me/account")
      assert json_response(conn, 200) == %{"ok" => true}

      updated = Repo.get!(Dating.Profile, profile.id)
      assert updated.deleted_at != nil
    end
  end

  defp authed_conn_without_profile do
    {:ok, user} =
      Accounts.create_user(%{
        email: "no-profile-#{System.unique_integer()}@example.com",
        display_name: "No Profile"
      })

    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: "profile-ctrl-no-profile-#{System.unique_integer()}",
        platform: "ios",
        device_name: "Test Device"
      })

    conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    %{user: user, conn: conn}
  end

  defp complete_profile_requirements(profile) do
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
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: "complete-photo-#{profile.id}-#{i}",
        url: "https://example.com/complete-photo-#{i}.jpg",
        position: i,
        is_active: true
      })
    end

    {:ok, tag} =
      Dating.create_tag(%{
        slug: "complete-tag-#{System.unique_integer()}",
        label: "Complete Tag",
        category: "test"
      })

    Dating.set_profile_tags(profile.id, [tag.id])
  end

  defp r2_test_config do
    [
      account_id: "test-account",
      access_key_id: "test-access-key",
      secret_access_key: "test-secret-key",
      bucket_name: "test-bucket",
      public_url_base: "https://cdn.example.test",
      allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
      max_upload_bytes: 2_000_000,
      upload_url_ttl_seconds: 600
    ]
  end
end
