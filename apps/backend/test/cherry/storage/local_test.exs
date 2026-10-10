defmodule Cherry.Storage.LocalTest do
  use ExUnit.Case, async: false

  alias Cherry.Storage.Local

  @jpeg <<255, 216, 255, 224, 0, 16, "JFIF", 0, 1, 1, 0::size(200)-unit(8)>>
  @png <<137, 80, 78, 71, 13, 10, 26, 10, 0::size(64)-unit(8)>>
  @webp <<"RIFF", 100::little-32, "WEBPVP8 ", 0::size(64)-unit(8)>>

  setup do
    previous = Application.get_env(:cherry, Local)
    dir = Path.join(System.tmp_dir!(), "cherry-local-test-#{System.unique_integer([:positive])}")

    Application.put_env(:cherry, Local,
      uploads_dir: dir,
      allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
      max_upload_bytes: 1_000,
      upload_url_ttl_seconds: 600
    )

    on_exit(fn ->
      Application.put_env(:cherry, Local, previous)
      File.rm_rf!(dir)
    end)

    %{dir: dir}
  end

  describe "upload_config/1 and presign_put/3" do
    test "returns the configured limits and expiry" do
      now = ~U[2026-09-29 10:00:00Z]

      assert {:ok,
              %{
                allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
                max_upload_bytes: 1_000,
                ttl_seconds: 600,
                expires_at: ~U[2026-09-29 10:10:00Z]
              }} = Local.upload_config(now)
    end

    test "signs a relative upload URL with the mandatory headers" do
      now = DateTime.utc_now()

      assert {:ok, upload} = Local.presign_put("profiles/p1/photo.jpg", "image/jpeg", now)

      assert "/api/uploads/" <> token = upload.upload_url
      assert upload.public_url == "/uploads/profiles/p1/photo.jpg"
      assert upload.method == "PUT"
      assert upload.headers == %{"Content-Type" => "image/jpeg", "If-None-Match" => "*"}
      assert upload.max_bytes == 1_000
      assert DateTime.diff(upload.expires_at, now) == 600

      assert {:ok,
              %{
                storage_key: "profiles/p1/photo.jpg",
                content_type: "image/jpeg",
                max_bytes: 1_000
              }} =
               Local.verify_upload_token(token)
    end

    test "rejects storage keys that escape the uploads directory" do
      for key <- ["../etc/passwd", "/etc/passwd", "profiles/../../x.jpg", ".tmp/x.jpg", ""] do
        assert {:error, :invalid_storage_key} = Local.presign_put(key, "image/jpeg")
      end
    end

    test "public_url/1 is the relative static path" do
      assert {:ok, "/uploads/profiles/p1/a.webp"} = Local.public_url("profiles/p1/a.webp")
    end
  end

  describe "verify_upload_token/1" do
    test "rejects expired tokens" do
      signed_at = DateTime.add(DateTime.utc_now(), -601, :second)
      {:ok, upload} = Local.presign_put("profiles/p1/old.jpg", "image/jpeg", signed_at)
      "/api/uploads/" <> token = upload.upload_url

      assert {:error, :upload_token_expired} = Local.verify_upload_token(token)
    end

    test "rejects tampered, foreign and oversized tokens" do
      {:ok, upload} = Local.presign_put("profiles/p1/a.jpg", "image/jpeg")
      "/api/uploads/" <> token = upload.upload_url
      [payload, signature] = String.split(token, ".", parts: 2) |> tamper()

      assert {:error, :upload_token_invalid} =
               Local.verify_upload_token(payload <> "." <> signature)

      foreign =
        Phoenix.Token.sign(CherryWeb.Endpoint, "another-salt", %{
          "k" => "profiles/p1/a.jpg",
          "t" => "image/jpeg",
          "m" => 1_000
        })

      assert {:error, :upload_token_invalid} = Local.verify_upload_token(foreign)
      assert {:error, :upload_token_invalid} = Local.verify_upload_token("garbage")

      assert {:error, :upload_token_invalid} =
               Local.verify_upload_token(String.duplicate("a", 3000))
    end
  end

  describe "begin/append/finish upload" do
    test "publishes the object atomically at uploads_dir/<storage_key>", %{dir: dir} do
      claims = claims("profiles/p1/a.jpg")

      assert {:ok, upload} = Local.begin_upload(claims)
      assert {:ok, upload} = Local.append_chunk(upload, binary_part(@jpeg, 0, 3))
      refute File.exists?(Path.join(dir, "profiles/p1/a.jpg"))

      assert {:ok, upload} =
               Local.append_chunk(upload, binary_part(@jpeg, 3, byte_size(@jpeg) - 3))

      assert :ok = Local.finish_upload(upload)

      assert File.read!(Path.join(dir, "profiles/p1/a.jpg")) == @jpeg
      assert File.ls!(Path.join(dir, ".tmp")) == []
    end

    test "never overwrites an existing object", %{dir: dir} do
      claims = claims("profiles/p1/a.png", "image/png")

      {:ok, first} = Local.begin_upload(claims)
      {:ok, second} = Local.begin_upload(claims)
      {:ok, first} = Local.append_chunk(first, @png)
      {:ok, second} = Local.append_chunk(second, <<137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3>>)

      assert :ok = Local.finish_upload(first)
      assert {:error, :upload_already_exists} = Local.finish_upload(second)
      assert {:error, :upload_already_exists} = Local.begin_upload(claims)

      assert File.read!(Path.join(dir, "profiles/p1/a.png")) == @png
      assert File.ls!(Path.join(dir, ".tmp")) == []
    end

    test "aborts when the body exceeds the signed maximum", %{dir: dir} do
      {:ok, upload} = Local.begin_upload(%{claims("profiles/p1/big.jpg") | max_bytes: 10})

      assert {:error, :upload_too_large} = Local.append_chunk(upload, @jpeg)
      refute File.exists?(Path.join(dir, "profiles/p1/big.jpg"))
      assert File.ls!(Path.join(dir, ".tmp")) == []
    end

    test "rejects bodies whose magic bytes do not match the signed type", %{dir: dir} do
      for {key, type, body} <- [
            {"profiles/p1/x.jpg", "image/jpeg", "<html>not an image</html>"},
            {"profiles/p1/y.webp", "image/webp", @png},
            {"profiles/p1/z.png", "image/png", ""}
          ] do
        {:ok, upload} = Local.begin_upload(claims(key, type))
        {:ok, upload} = Local.append_chunk(upload, body)

        assert {:error, :upload_invalid_image} = Local.finish_upload(upload)
        refute File.exists?(Path.join(dir, key))
      end

      assert File.ls!(Path.join(dir, ".tmp")) == []
    end

    test "sweeps stale temporary files", %{dir: dir} do
      tmp_dir = Path.join(dir, ".tmp")
      File.mkdir_p!(tmp_dir)
      stale = Path.join(tmp_dir, "stale.part")
      File.write!(stale, "x")
      File.touch!(stale, System.os_time(:second) - 7200)

      {:ok, upload} = Local.begin_upload(claims("profiles/p1/new.jpg"))
      Local.abort_upload(upload)

      refute File.exists?(stale)
    end
  end

  describe "verify_upload/1" do
    test "accepts every supported image type", %{dir: dir} do
      for {key, type, body} <- [
            {"profiles/p1/a.jpg", "image/jpeg", @jpeg},
            {"profiles/p1/b.png", "image/png", @png},
            {"profiles/p1/c.webp", "image/webp", @webp}
          ] do
        write_object(dir, key, body)

        assert :ok =
                 Local.verify_upload(%{
                   storage_key: key,
                   content_type: type,
                   size_bytes: byte_size(body)
                 })
      end
    end

    test "reports the same errors as R2", %{dir: dir} do
      write_object(dir, "profiles/p1/a.jpg", @jpeg)
      write_object(dir, "profiles/p1/b.png", @png)
      write_object(dir, "profiles/p1/fake.jpg", "GIF89a-not-a-jpeg")
      write_object(dir, "profiles/p1/huge.jpg", @jpeg <> :binary.copy(<<0>>, 1_000))

      assert {:error, :upload_object_not_found} =
               Local.verify_upload(%{
                 storage_key: "profiles/p1/missing.jpg",
                 content_type: "image/jpeg",
                 size_bytes: 10
               })

      assert {:error, :upload_size_mismatch} =
               Local.verify_upload(%{
                 storage_key: "profiles/p1/a.jpg",
                 content_type: "image/jpeg",
                 size_bytes: byte_size(@jpeg) + 1
               })

      assert {:error, :upload_size_mismatch} =
               Local.verify_upload(%{
                 storage_key: "profiles/p1/huge.jpg",
                 content_type: "image/jpeg",
                 size_bytes: byte_size(@jpeg) + 1_000
               })

      assert {:error, :upload_content_type_mismatch} =
               Local.verify_upload(%{
                 storage_key: "profiles/p1/b.png",
                 content_type: "image/jpeg",
                 size_bytes: byte_size(@png)
               })

      assert {:error, :upload_invalid_image} =
               Local.verify_upload(%{
                 storage_key: "profiles/p1/fake.jpg",
                 content_type: "image/jpeg",
                 size_bytes: byte_size("GIF89a-not-a-jpeg")
               })

      assert {:error, :upload_object_not_found} =
               Local.verify_upload(%{
                 storage_key: "../outside.jpg",
                 content_type: "image/jpeg",
                 size_bytes: 10
               })
    end
  end

  describe "promote/2 and delete_object/1" do
    test "move a pending object to its public key and delete objects", %{dir: dir} do
      write_object(dir, "pending/photos/a.jpg", @jpeg)

      assert :ok = Local.promote("pending/photos/a.jpg", "photos/a.jpg")
      assert File.read!(Path.join(dir, "photos/a.jpg")) == @jpeg
      refute File.exists?(Path.join(dir, "pending/photos/a.jpg"))

      # Idempotent from the caller's point of view.
      assert {:error, :upload_object_not_found} =
               Local.promote("pending/photos/a.jpg", "photos/a.jpg")

      assert :ok = Local.delete_object("photos/a.jpg")
      refute File.exists?(Path.join(dir, "photos/a.jpg"))
      assert :ok = Local.delete_object("photos/a.jpg")
      assert :ok = Local.delete_object("../outside.jpg")
    end

    test "a pending key cannot be uploaded again once published", %{dir: dir} do
      write_object(dir, "photos/b.jpg", @jpeg)

      assert {:error, :upload_already_exists} =
               Local.begin_upload(claims("pending/photos/b.jpg"))
    end
  end

  defp claims(key, content_type \\ "image/jpeg"),
    do: %{storage_key: key, content_type: content_type, max_bytes: 1_000}

  defp write_object(dir, key, body) do
    path = Path.join(dir, key)
    File.mkdir_p!(Path.dirname(path))
    File.write!(path, body)
  end

  # Flip one character of the signature so the HMAC no longer matches.
  defp tamper([payload, signature]) do
    <<first, rest::binary>> = signature
    [payload, <<if(first == ?A, do: ?B, else: ?A), rest::binary>>]
  end
end
