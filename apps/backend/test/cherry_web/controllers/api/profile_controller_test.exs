defmodule CherryWeb.Controllers.Api.ProfileControllerTest do
  use CherryWeb.ConnCase, async: false

  alias Cherry.Accounts
  alias Cherry.Dating
  alias Cherry.Dating.ProfilePhotoUploadIntent
  alias Cherry.Repo
  alias Cherry.Sessions

  setup do
    original_r2_config = Application.get_env(:cherry, Cherry.Storage.R2)
    Application.put_env(:cherry, Cherry.Storage.R2, r2_test_config())
    on_exit(fn -> Application.put_env(:cherry, Cherry.Storage.R2, original_r2_config) end)
    config = Application.get_env(:cherry, Cherry.Storage.R2)

    Application.put_env(
      :cherry,
      Cherry.Storage.R2,
      Keyword.put(config, :request_options, plug: {Req.Test, Cherry.Storage.R2})
    )

    test_pid = self()

    Req.Test.stub(Cherry.Storage.R2, fn conn ->
      conn =
        conn
        |> Plug.Conn.put_resp_header("content-type", "image/jpeg")
        |> Plug.Conn.put_resp_header("etag", "\"test-object\"")

      send(test_pid, {:r2_request, conn.method, conn.request_path, conn.req_headers})

      case conn.method do
        # CopyObject (publish from pending/) and DeleteObject.
        "PUT" ->
          Plug.Conn.send_resp(conn, 200, "<CopyObjectResult/>")

        "DELETE" ->
          Plug.Conn.send_resp(conn, 204, "")

        "HEAD" ->
          conn
          |> Plug.Conn.put_resp_header("content-length", "420000")
          |> Plug.Conn.send_resp(200, "")

        "GET" ->
          conn
          |> Plug.Conn.put_resp_header("content-range", "bytes 0-31/420000")
          |> Plug.Conn.send_resp(206, <<255, 216, 255, 224, 0::224>>)
      end
    end)

    {:ok, user} =
      Accounts.create_user(%{email: "profile_ctrl@example.com", display_name: "Profile Ctrl"})

    {:ok, profile} =
      Dating.create_profile(%{
        user_id: user.id,
        display_name: "Test User",
        birth_date: ~D[1995-01-15],
        gender: "man",
        looking_for: ["relationship"],
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

    test "accepts several intents and returns them as lookingFor", %{authed_conn: conn} do
      conn =
        put(conn, "/api/me/profile", %{"looking_for" => ["meet_people", "relationship"]})

      assert %{
               "profile" => %{
                 "lookingFor" => ["relationship", "meet_people"],
                 "whatIAmLookingFor" => "relationship"
               }
             } = json_response(conn, 200)
    end

    test "accepts the old single what_i_am_looking_for string", %{authed_conn: conn} do
      conn = put(conn, "/api/me/profile", %{"what_i_am_looking_for" => "casual"})

      assert %{"profile" => %{"lookingFor" => ["casual"], "whatIAmLookingFor" => "casual"}} =
               json_response(conn, 200)
    end

    test "rejects an empty or duplicated intent list", %{authed_conn: conn} do
      for value <- [[], ["casual", "casual"], ["friends"]] do
        response = conn |> put("/api/me/profile", %{"looking_for" => value}) |> json_response(422)
        assert %{"errors" => %{"looking_for" => [_ | _]}} = response
      end
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

    test "the birth date must reach the instance's minimum age", %{
      authed_conn: conn,
      profile: profile
    } do
      complete_profile_requirements(profile)
      previous = Application.get_env(:cherry, :age_verification)
      on_exit(fn -> Application.put_env(:cherry, :age_verification, previous) end)

      # Born 1995-01-15: an adult at 18, not at an (unrealistic) minimum of 99.
      Application.put_env(:cherry, :age_verification, Keyword.put(previous, :minimum_age, 99))

      conn = post(conn, "/api/me/profile/complete")
      assert %{"missing" => ["birth_date"]} = json_response(conn, 422)
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

    test "only accepts latitude/longitude, never a raw geometry", %{
      authed_conn: conn,
      profile: profile
    } do
      polygon = %{
        "type" => "Polygon",
        "coordinates" => [[[-3.7, 40.4], [-3.6, 40.4], [-3.6, 40.5], [-3.7, 40.4]]]
      }

      assert conn |> post("/api/me/location", %{"coordinates" => polygon}) |> json_response(422)
      assert Dating.get_location(profile.id) == nil

      # A precise point next to latitude/longitude is ignored: the grid always applies.
      assert %{"ok" => true} =
               conn
               |> post("/api/me/location", %{
                 "latitude" => 40.4168,
                 "longitude" => -3.7038,
                 "coordinates" => %{"type" => "Point", "coordinates" => [2.1734, 41.3851]}
               })
               |> json_response(200)

      assert %Geo.Point{coordinates: {longitude, latitude}} =
               Dating.get_location(profile.id).coordinates

      assert abs(latitude - 40.4168) < 0.01 and latitude != 40.4168
      assert abs(longitude - -3.7038) < 0.01
    end

    test "ignores updates closer than 60 s to the previous one", %{
      authed_conn: conn,
      profile: profile
    } do
      madrid = %{"latitude" => 40.4168, "longitude" => -3.7038}
      barcelona = %{"latitude" => 41.3851, "longitude" => 2.1734}

      assert %{"ok" => true} = conn |> post("/api/me/location", madrid) |> json_response(200)
      assert %{"ok" => true} = conn |> post("/api/me/location", barcelona) |> json_response(200)
      assert %Geo.Point{coordinates: {lng, _lat}} = Dating.get_location(profile.id).coordinates
      assert lng < 0

      a_minute_ago =
        DateTime.utc_now() |> DateTime.add(-61, :second) |> DateTime.truncate(:second)

      Repo.query!("UPDATE profile_locations SET updated_at = $1 WHERE profile_id = $2", [
        a_minute_ago,
        Ecto.UUID.dump!(profile.id)
      ])

      assert %{"ok" => true} = conn |> post("/api/me/location", barcelona) |> json_response(200)
      assert %Geo.Point{coordinates: {lng, _lat}} = Dating.get_location(profile.id).coordinates
      assert lng > 0
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
               "headers" => %{"Content-Type" => "image/jpeg", "If-None-Match" => "*"},
               "maxBytes" => 2_000_000
             } = json_response(conn, 200)

      assert String.starts_with?(storage_key, "photos/")
      refute String.contains?(storage_key, profile.id)
      assert String.ends_with?(storage_key, ".jpg")
      # The PUT goes to the pending area; the public URL is the final key.
      assert String.contains?(
               upload_url,
               "test-account.r2.cloudflarestorage.com/test-bucket/pending/#{storage_key}?"
             )

      assert String.contains?(upload_url, "X-Amz-Signature=")

      assert URI.decode_query(URI.parse(upload_url).query)["X-Amz-SignedHeaders"] ==
               "content-type;host;if-none-match"

      assert public_url ==
               "https://test-account.r2.cloudflarestorage.com/test-bucket/#{storage_key}"

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
    for {scenario, expected_error} <- [
          {:missing, "upload_object_not_found"},
          {:size, "upload_size_mismatch"},
          {:mime, "upload_content_type_mismatch"},
          {:content, "upload_invalid_image"},
          {:unavailable, "storage_unavailable"}
        ] do
      @scenario scenario
      @expected_error expected_error
      @status if(scenario == :unavailable, do: 503, else: 422)
      test "rejects an upload with #{@scenario} storage data", %{
        authed_conn: conn,
        profile: profile
      } do
        scenario = @scenario
        stub_invalid_upload(scenario)

        {:ok, upload} =
          Dating.create_photo_upload_intent(profile, %{
            position: 1,
            content_type: "image/jpeg",
            size_bytes: 420_000
          })

        assert %{"error" => @expected_error} =
                 conn
                 |> post("/api/me/photos/complete", %{"storageKey" => upload.storage_key})
                 |> json_response(@status)

        refute Repo.get_by(Dating.ProfilePhoto, storage_key: upload.storage_key)

        assert Repo.get_by!(ProfilePhotoUploadIntent, storage_key: upload.storage_key).completed_at ==
                 nil
      end
    end

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
      assert String.starts_with?(public_url, upload.public_url <> "?")
      assert public_url =~ "X-Amz-Expires=300"

      # Published with a server-side copy out of pending/, then the copy source is deleted.
      assert_received {:r2_request, "PUT", copy_path, copy_headers}
      assert copy_path == "/test-bucket/#{storage_key}"

      assert {"x-amz-copy-source", "/test-bucket/pending/#{storage_key}"} in copy_headers
      assert_received {:r2_request, "DELETE", delete_path, _headers}
      assert delete_path == "/test-bucket/pending/#{storage_key}"

      assert Repo.get_by!(Dating.ProfilePhoto, storage_key: upload.storage_key).profile_id ==
               profile.id

      assert Repo.get_by!(ProfilePhotoUploadIntent, storage_key: upload.storage_key).completed_at !=
               nil

      assert %{"error" => "upload_intent_completed"} =
               conn
               |> recycle()
               |> post("/api/me/photos/complete", %{"storageKey" => upload.storage_key})
               |> json_response(422)
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
    test "physically deletes the profile and account", %{authed_conn: conn, profile: profile} do
      conn = delete(conn, "/api/me/account")
      assert json_response(conn, 200) == %{"ok" => true}

      refute Repo.get(Dating.Profile, profile.id)
      refute Repo.get(Cherry.Accounts.User, profile.user_id)
    end
  end

  defp stub_invalid_upload(scenario) do
    Req.Test.stub(Cherry.Storage.R2, fn conn ->
      cond do
        scenario == :missing ->
          Plug.Conn.send_resp(conn, 404, "")

        scenario == :unavailable ->
          Plug.Conn.send_resp(conn, 503, "")

        conn.method == "HEAD" ->
          conn
          |> Plug.Conn.put_resp_header(
            "content-length",
            if(scenario == :size, do: "999", else: "420000")
          )
          |> Plug.Conn.put_resp_header(
            "content-type",
            if(scenario == :mime, do: "text/html", else: "image/jpeg")
          )
          |> Plug.Conn.put_resp_header("etag", "\"test-object\"")
          |> Plug.Conn.send_resp(200, "")

        true ->
          conn
          |> Plug.Conn.put_resp_header("content-range", "bytes 0-31/420000")
          |> Plug.Conn.send_resp(206, "<html>not an image</html>")
      end
    end)
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
