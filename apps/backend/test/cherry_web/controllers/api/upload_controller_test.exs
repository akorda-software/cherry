defmodule CherryWeb.Controllers.Api.UploadControllerTest do
  @moduledoc "Local photo storage end to end: intent → PUT /api/uploads/:token → complete."
  use CherryWeb.ConnCase, async: false

  alias Cherry.Accounts
  alias Cherry.Dating
  alias Cherry.Repo
  alias Cherry.Sessions
  alias Cherry.Storage.Local

  @jpeg <<255, 216, 255, 224, 0, 16, "JFIF", 0, 1, 1, 0::size(4000)-unit(8)>>

  setup do
    previous_storage = Application.get_env(:cherry, Cherry.Storage)
    previous_local = Application.get_env(:cherry, Local)
    dir = Path.join(System.tmp_dir!(), "cherry-upload-test-#{System.unique_integer([:positive])}")

    Application.put_env(:cherry, Cherry.Storage, adapter: Local)

    Application.put_env(:cherry, Local,
      uploads_dir: dir,
      allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
      max_upload_bytes: 10_000,
      upload_url_ttl_seconds: 600
    )

    on_exit(fn ->
      Application.put_env(:cherry, Cherry.Storage, previous_storage)
      Application.put_env(:cherry, Local, previous_local)
      File.rm_rf!(dir)
    end)

    {:ok, user} =
      Accounts.create_user(%{email: "uploads@example.com", display_name: "Uploads"})

    {:ok, profile} =
      Dating.create_profile(%{
        user_id: user.id,
        display_name: "Uploader",
        birth_date: ~D[1994-03-02],
        gender: "woman",
        looking_for: ["relationship"],
        bio: "Subo fotos de mi gata como si fuera mi agente de prensa."
      })

    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: "uploads-install",
        platform: "ios",
        device_name: "Test Device"
      })

    authed_conn =
      build_conn()
      |> put_req_header("authorization", "Bearer #{issued.session.access_token}")

    %{authed_conn: authed_conn, profile: profile, dir: dir}
  end

  test "full flow: intent, raw PUT, complete and static serving", %{
    authed_conn: authed_conn,
    profile: profile,
    dir: dir
  } do
    intent =
      authed_conn
      |> post("/api/me/photos/upload-intent", %{
        "position" => 1,
        "contentType" => "image/jpeg",
        "sizeBytes" => byte_size(@jpeg)
      })
      |> json_response(200)

    assert %{
             "storageKey" => storage_key,
             "uploadUrl" => "http://www.example.com/api/uploads/" <> _token = upload_url,
             "publicUrl" => public_url,
             "method" => "PUT",
             "headers" => %{"Content-Type" => "image/jpeg", "If-None-Match" => "*"} = headers,
             "maxBytes" => 10_000
           } = intent

    # Random key, nothing about the profile in the path.
    assert "photos/" <> file = storage_key
    refute String.contains?(storage_key, profile.id)
    assert file =~ ~r/^[0-9a-f]{32}\.jpg$/
    assert public_url == "http://www.example.com/uploads/#{storage_key}"

    # The upload URL carries its own authorisation: no Bearer header.
    assert build_conn()
           |> put_headers(headers)
           |> put(URI.parse(upload_url).path, @jpeg)
           |> json_response(200) == %{"ok" => true}

    # Uploaded to the non-public pending area until completed.
    assert File.read!(Path.join(dir, "pending/" <> storage_key)) == @jpeg
    refute File.exists?(Path.join(dir, storage_key))
    assert get(build_conn(), "/uploads/#{storage_key}").status == 404
    assert get(build_conn(), "/uploads/pending/#{storage_key}").status == 404

    assert %{"photo" => photo} =
             authed_conn
             |> post("/api/me/photos/complete", %{
               "storageKey" => storage_key,
               "publicUrl" => public_url,
               "position" => 1,
               "contentType" => "image/jpeg",
               "sizeBytes" => byte_size(@jpeg)
             })
             |> json_response(200)

    assert %{"storageKey" => ^storage_key, "url" => ^public_url, "position" => 1} = photo
    assert File.read!(Path.join(dir, storage_key)) == @jpeg
    refute File.exists?(Path.join(dir, "pending/" <> storage_key))

    stored = Repo.get_by!(Dating.ProfilePhoto, storage_key: storage_key)
    assert stored.url == "/uploads/#{storage_key}"

    assert %{"photos" => [%{"url" => ^public_url}]} =
             authed_conn |> get("/api/me/photos") |> json_response(200)

    served = get(build_conn(), "/uploads/#{storage_key}")
    assert served.status == 200
    assert served.resp_body == @jpeg
    assert get_resp_header(served, "content-type") == ["image/jpeg"]
    assert get_resp_header(served, "cache-control") == ["public, max-age=86400"]
    assert get_resp_header(served, "x-content-type-options") == ["nosniff"]
  end

  test "honours PUBLIC_BASE_URL for upload and public URLs", %{authed_conn: authed_conn} do
    previous = Application.get_env(:cherry, :public_base_url)
    Application.put_env(:cherry, :public_base_url, "https://api.cherry.example/")
    on_exit(fn -> Application.put_env(:cherry, :public_base_url, previous) end)

    assert %{"uploadUrl" => upload_url, "publicUrl" => public_url} =
             authed_conn
             |> post("/api/me/photos/upload-intent", %{
               "position" => 1,
               "contentType" => "image/jpeg",
               "sizeBytes" => byte_size(@jpeg)
             })
             |> json_response(200)

    assert String.starts_with?(upload_url, "https://api.cherry.example/api/uploads/")
    assert String.starts_with?(public_url, "https://api.cherry.example/uploads/photos/")
  end

  test "rejects a second PUT to the same URL with 412", %{profile: profile} do
    {path, _key} = local_intent(profile)

    assert conn_put(path, @jpeg).status == 200

    assert %{"error" => "upload_already_exists"} =
             path |> conn_put(@jpeg <> "x") |> json_response(412)
  end

  test "a PUT after completing cannot recreate the pending object", %{
    profile: profile,
    dir: dir
  } do
    {path, key} = local_intent(profile)
    assert conn_put(path, @jpeg).status == 200

    assert {:ok, _photo} =
             Dating.complete_photo_upload(profile, %{"storageKey" => key})

    assert %{"error" => "upload_already_exists"} =
             path |> conn_put(@jpeg) |> json_response(412)

    refute File.exists?(Path.join(dir, "pending/" <> key))
  end

  test "deleting a photo removes its file", %{
    authed_conn: authed_conn,
    profile: profile,
    dir: dir
  } do
    {path, key} = local_intent(profile)
    assert conn_put(path, @jpeg).status == 200
    assert {:ok, photo} = Dating.complete_photo_upload(profile, %{"storageKey" => key})
    assert File.exists?(Path.join(dir, key))

    assert %{"ok" => true} =
             authed_conn |> delete("/api/me/photos/#{photo.id}") |> json_response(200)

    refute File.exists?(Path.join(dir, key))
    assert get(build_conn(), "/uploads/#{key}").status == 404
    assert Repo.get!(Dating.ProfilePhoto, photo.id).storage_deleted_at
  end

  test "deleting the account removes every photo file", %{
    authed_conn: authed_conn,
    profile: profile,
    dir: dir
  } do
    {path, key} = local_intent(profile)
    assert conn_put(path, @jpeg).status == 200
    assert {:ok, _photo} = Dating.complete_photo_upload(profile, %{"storageKey" => key})

    assert authed_conn |> delete("/api/me/account") |> json_response(200)
    refute File.exists?(Path.join(dir, key))
  end

  test "the sweeper deletes abandoned uploads once the intent expires", %{
    profile: profile,
    dir: dir
  } do
    {path, key} = local_intent(profile)
    assert conn_put(path, @jpeg).status == 200
    pending = Path.join(dir, "pending/" <> key)
    assert File.exists?(pending)

    # Not before expiry (plus a grace period).
    assert %{intents: 0} = Cherry.Dating.PhotoStorage.sweep()
    assert File.exists?(pending)

    later = DateTime.add(DateTime.utc_now(), 3600, :second)
    assert %{intents: 1} = Cherry.Dating.PhotoStorage.sweep(later)
    refute File.exists?(pending)

    assert Repo.get_by!(Dating.ProfilePhotoUploadIntent, storage_key: key).storage_deleted_at
    assert %{intents: 0} = Cherry.Dating.PhotoStorage.sweep(later)
  end

  test "the sweeper purges photos deleted before physical deletion existed", %{
    profile: profile,
    dir: dir
  } do
    File.mkdir_p!(Path.join(dir, "profiles/legacy"))
    File.write!(Path.join(dir, "profiles/legacy/a.jpg"), @jpeg)

    {:ok, photo} =
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: "profiles/legacy/a.jpg",
        url: "/uploads/profiles/legacy/a.jpg",
        position: 1,
        is_active: false
      })

    # Photos linked from elsewhere (demo seeds) are never touched.
    {:ok, _external} =
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: "demo/someone/1",
        url: "https://example.com/1.jpg",
        position: 2,
        is_active: false
      })

    assert %{photos: 2} = Cherry.Dating.PhotoStorage.sweep()
    refute File.exists?(Path.join(dir, "profiles/legacy/a.jpg"))
    assert Repo.get!(Dating.ProfilePhoto, photo.id).storage_deleted_at
    assert %{photos: 0} = Cherry.Dating.PhotoStorage.sweep()
  end

  test "limits live upload intents per profile and intents per hour", %{
    authed_conn: authed_conn,
    profile: profile
  } do
    body = %{"position" => 1, "contentType" => "image/jpeg", "sizeBytes" => byte_size(@jpeg)}

    for _ <- 1..4 do
      assert authed_conn |> post("/api/me/photos/upload-intent", body) |> json_response(200)
    end

    assert %{"error" => "too_many_upload_intents"} =
             authed_conn |> post("/api/me/photos/upload-intent", body) |> json_response(429)

    # Expired intents no longer count as live, but they do count per hour.
    Repo.update_all(Dating.ProfilePhotoUploadIntent,
      set: [
        expires_at: DateTime.add(DateTime.utc_now(), -60, :second) |> DateTime.truncate(:second)
      ]
    )

    for _ <- 1..16 do
      {:ok, _} =
        Dating.create_photo_upload_intent(profile, %{
          position: 1,
          content_type: "image/jpeg",
          size_bytes: 100
        })

      Repo.update_all(Dating.ProfilePhotoUploadIntent,
        set: [
          expires_at: DateTime.add(DateTime.utc_now(), -60, :second) |> DateTime.truncate(:second)
        ]
      )
    end

    assert %{"error" => "upload_rate_limited"} =
             authed_conn |> post("/api/me/photos/upload-intent", body) |> json_response(429)
  end

  test "rejects expired and tampered tokens with 403", %{profile: profile} do
    {:ok, upload} =
      Dating.create_photo_upload_intent(profile, %{
        position: 1,
        content_type: "image/jpeg",
        size_bytes: byte_size(@jpeg)
      })

    {:ok, expired} =
      Local.presign_put(
        upload.storage_key,
        "image/jpeg",
        DateTime.add(DateTime.utc_now(), -3600, :second)
      )

    assert %{"error" => "upload_token_expired"} =
             expired.upload_url |> conn_put(@jpeg) |> json_response(403)

    "/api/uploads/" <> token = upload.upload_url
    [protected, rest] = String.split(token, ".", parts: 2)
    <<first, tail::binary>> = rest
    tampered = protected <> "." <> <<if(first == ?A, do: ?B, else: ?A), tail::binary>>

    assert %{"error" => "upload_token_invalid"} =
             ("/api/uploads/" <> tampered) |> conn_put(@jpeg) |> json_response(403)

    assert %{"error" => "upload_token_invalid"} =
             "/api/uploads/not-a-token" |> conn_put(@jpeg) |> json_response(403)
  end

  test "enforces the signed maximum size", %{profile: profile, dir: dir} do
    {path, key} = local_intent(profile)
    too_big = @jpeg <> :binary.copy(<<0>>, 10_000)

    # Declared Content-Length: rejected before reading the body.
    assert %{"error" => "upload_too_large"} =
             build_conn()
             |> put_req_header("content-type", "image/jpeg")
             |> put_req_header("content-length", Integer.to_string(byte_size(too_big)))
             |> put(path, too_big)
             |> json_response(413)

    # No Content-Length (chunked): the streamed byte count still stops it.
    assert %{"error" => "upload_too_large"} =
             path |> conn_put(too_big) |> json_response(413)

    refute File.exists?(Path.join(dir, key))
  end

  test "rejects a different content type with 415", %{profile: profile} do
    {path, _key} = local_intent(profile)

    assert %{"error" => "upload_content_type_mismatch"} =
             build_conn()
             |> put_req_header("content-type", "image/png")
             |> put(path, <<137, 80, 78, 71, 13, 10, 26, 10, 0::64>>)
             |> json_response(415)

    assert %{"error" => "upload_content_type_mismatch"} =
             build_conn()
             |> put_req_header("content-type", "application/json")
             |> put(path, ~s({"a": 1}))
             |> json_response(415)
  end

  test "rejects bodies that are not the declared image with 422", %{profile: profile, dir: dir} do
    {path, key} = local_intent(profile)

    assert %{"error" => "upload_invalid_image"} =
             path |> conn_put("<html>definitely not a jpeg</html>") |> json_response(422)

    refute File.exists?(Path.join(dir, key))
  end

  test "complete reports verification errors with 422 and keeps the intent", %{
    authed_conn: authed_conn,
    profile: profile
  } do
    {_path, key} = local_intent(profile)

    assert %{"error" => "upload_object_not_found"} =
             authed_conn
             |> post("/api/me/photos/complete", %{"storageKey" => key})
             |> json_response(422)

    refute Repo.get_by(Dating.ProfilePhoto, storage_key: key)
  end

  test "rejects a public URL for another object", %{authed_conn: authed_conn, profile: profile} do
    {path, key} = local_intent(profile)
    assert conn_put(path, @jpeg).status == 200

    assert %{"error" => "upload_url_mismatch"} =
             authed_conn
             |> post("/api/me/photos/complete", %{
               "storageKey" => key,
               "publicUrl" => "http://www.example.com/uploads/profiles/other/x.jpg"
             })
             |> json_response(422)
  end

  test "upload-intent answers 503 when no storage is configured", %{authed_conn: authed_conn} do
    Application.put_env(:cherry, Cherry.Storage, adapter: nil)

    assert %{"error" => "storage_not_configured"} =
             authed_conn
             |> post("/api/me/photos/upload-intent", %{
               "position" => 1,
               "contentType" => "image/jpeg",
               "sizeBytes" => 1_000
             })
             |> json_response(503)
  end

  test "the upload route does not exist unless local storage is active", %{profile: profile} do
    {path, _key} = local_intent(profile)
    Application.put_env(:cherry, Cherry.Storage, adapter: Cherry.Storage.R2)

    assert %{"error" => "not_found"} = path |> conn_put(@jpeg) |> json_response(404)
  end

  test "static serving never lists directories nor exposes staging files", %{dir: dir} do
    File.mkdir_p!(Path.join(dir, ".tmp"))
    File.write!(Path.join(dir, ".tmp/leak.part"), "secret")
    File.mkdir_p!(Path.join(dir, "profiles/p1"))
    File.mkdir_p!(Path.join(dir, "pending/photos"))
    File.write!(Path.join(dir, "pending/photos/x.jpg"), @jpeg)
    File.write!(Path.join(dir, "notes.txt"), "secret")

    for path <- [
          "/uploads/.tmp/leak.part",
          "/uploads/pending/photos/x.jpg",
          "/uploads/profiles",
          "/uploads/profiles/p1",
          "/uploads/notes.txt"
        ] do
      assert get(build_conn(), path).status == 404, path
    end
  end

  defp local_intent(profile) do
    {:ok, upload} =
      Dating.create_photo_upload_intent(profile, %{
        position: 1,
        content_type: "image/jpeg",
        size_bytes: byte_size(@jpeg)
      })

    {upload.upload_url, upload.storage_key}
  end

  defp conn_put(path, body) do
    build_conn()
    |> put_req_header("content-type", "image/jpeg")
    |> put_req_header("if-none-match", "*")
    |> put(path, body)
  end

  defp put_headers(conn, headers) do
    Enum.reduce(headers, conn, fn {name, value}, conn ->
      put_req_header(conn, String.downcase(name), value)
    end)
  end
end
