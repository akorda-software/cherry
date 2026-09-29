defmodule Snack.Storage.R2Test do
  use ExUnit.Case, async: false
  alias Snack.Storage.R2

  setup do
    previous = Application.get_env(:snack, R2)

    Application.put_env(:snack, R2,
      account_id: "account",
      bucket_name: "bucket",
      access_key_id: "access",
      secret_access_key: "secret",
      public_url_base: "https://cdn.test",
      request_options: [plug: {Req.Test, R2}]
    )

    on_exit(fn -> Application.put_env(:snack, R2, previous) end)
  end

  test "validates each supported image type using authenticated conditional reads" do
    for {mime, bytes} <- [
          {"image/jpeg", <<255, 216, 255, 224, 0::224>>},
          {"image/png", <<137, 80, 78, 71, 13, 10, 26, 10, 0::192>>},
          {"image/webp", <<"RIFF", 100::little-32, "WEBPVP8 ", 0::128>>}
        ] do
      Req.Test.stub(R2, fn conn ->
        assert conn.host == "account.r2.cloudflarestorage.com"
        assert conn.request_path == "/bucket/profiles/photo"
        assert [authorization] = Plug.Conn.get_req_header(conn, "authorization")
        assert authorization =~ "AWS4-HMAC-SHA256"
        assert authorization =~ "/auto/s3/aws4_request"

        if conn.method == "HEAD" do
          conn
          |> Plug.Conn.put_resp_header("content-length", "100")
          |> Plug.Conn.put_resp_header("content-type", mime)
          |> Plug.Conn.put_resp_header("etag", "\"etag\"")
          |> Plug.Conn.send_resp(200, "")
        else
          assert Plug.Conn.get_req_header(conn, "range") == ["bytes=0-31"]
          assert Plug.Conn.get_req_header(conn, "if-match") == ["\"etag\""]
          Plug.Conn.send_resp(conn, 206, bytes)
        end
      end)

      assert :ok =
               R2.verify_upload(%{
                 storage_key: "profiles/photo",
                 content_type: mime,
                 size_bytes: 100
               })
    end
  end

  test "signs presigned PUTs for R2 by default" do
    assert {:ok, upload} = R2.presign_put("profiles/p1/a.jpg", "image/jpeg")

    uri = URI.parse(upload.upload_url)
    query = URI.decode_query(uri.query)

    assert uri.scheme == "https"
    assert uri.host == "account.r2.cloudflarestorage.com"
    assert uri.path == "/bucket/profiles/p1/a.jpg"
    assert query["X-Amz-Credential"] =~ ~r"^access/\d{8}/auto/s3/aws4_request$"
    assert query["X-Amz-SignedHeaders"] == "content-type;host;if-none-match"
    assert upload.public_url == "https://cdn.test/profiles/p1/a.jpg"
    assert {:ok, "https://cdn.test/profiles/p1/a.jpg"} = R2.public_url("profiles/p1/a.jpg")
  end

  describe "generic S3 endpoint (MinIO, Garage...)" do
    setup do
      Application.put_env(:snack, R2,
        endpoint: "http://minio.test:9000",
        region: "us-east-1",
        bucket_name: "bucket",
        access_key_id: "access",
        secret_access_key: "secret",
        public_url_base: "http://minio.test:9000/bucket",
        request_options: [plug: {Req.Test, R2}]
      )
    end

    test "presigns against the endpoint with its region and port in the host" do
      now = ~U[2026-09-29 10:00:00Z]
      assert {:ok, upload} = R2.presign_put("profiles/p1/a.jpg", "image/jpeg", now)

      uri = URI.parse(upload.upload_url)
      query = URI.decode_query(uri.query)

      assert {uri.scheme, uri.host, uri.port} == {"http", "minio.test", 9000}
      assert uri.path == "/bucket/profiles/p1/a.jpg"
      assert query["X-Amz-Credential"] == "access/20260929/us-east-1/s3/aws4_request"
      assert query["X-Amz-Date"] == "20260929T100000Z"
      assert upload.headers == %{"Content-Type" => "image/jpeg", "If-None-Match" => "*"}
      assert upload.public_url == "http://minio.test:9000/bucket/profiles/p1/a.jpg"

      # Deterministic SigV4 over the host *with* port (non-default).
      canonical_request =
        Enum.join(
          [
            "PUT",
            "/bucket/profiles/p1/a.jpg",
            uri.query |> String.split("&X-Amz-Signature=") |> hd(),
            "content-type:image/jpeg\nhost:minio.test:9000\nif-none-match:*\n",
            "content-type;host;if-none-match",
            "UNSIGNED-PAYLOAD"
          ],
          "\n"
        )

      string_to_sign =
        Enum.join(
          [
            "AWS4-HMAC-SHA256",
            "20260929T100000Z",
            "20260929/us-east-1/s3/aws4_request",
            :crypto.hash(:sha256, canonical_request) |> Base.encode16(case: :lower)
          ],
          "\n"
        )

      key =
        Enum.reduce(["20260929", "us-east-1", "s3", "aws4_request"], "AWS4secret", fn data, key ->
          :crypto.mac(:hmac, :sha256, key, data)
        end)

      assert query["X-Amz-Signature"] ==
               :crypto.mac(:hmac, :sha256, key, string_to_sign) |> Base.encode16(case: :lower)
    end

    test "verifies uploads through the endpoint" do
      Req.Test.stub(R2, fn conn ->
        assert conn.host == "minio.test"
        assert conn.port == 9000
        assert conn.request_path == "/bucket/profiles/photo"
        assert [authorization] = Plug.Conn.get_req_header(conn, "authorization")
        assert authorization =~ "/us-east-1/s3/aws4_request"

        if conn.method == "HEAD" do
          conn
          |> Plug.Conn.put_resp_header("content-length", "100")
          |> Plug.Conn.put_resp_header("content-type", "image/png")
          |> Plug.Conn.put_resp_header("etag", "\"etag\"")
          |> Plug.Conn.send_resp(200, "")
        else
          Plug.Conn.send_resp(conn, 206, <<137, 80, 78, 71, 13, 10, 26, 10, 0::192>>)
        end
      end)

      assert :ok =
               R2.verify_upload(%{
                 storage_key: "profiles/photo",
                 content_type: "image/png",
                 size_bytes: 100
               })
    end

    test "requires either an account id or a valid endpoint" do
      config = Application.get_env(:snack, R2)
      Application.put_env(:snack, R2, Keyword.put(config, :endpoint, "not a url"))

      assert {:error, :storage_not_configured} = R2.presign_put("profiles/a.jpg", "image/jpeg")
      assert {:error, :storage_not_configured} = R2.upload_config()
    end
  end

  test "fails closed when the object changes between HEAD and GET" do
    Req.Test.stub(R2, fn conn ->
      if conn.method == "HEAD" do
        conn
        |> Plug.Conn.put_resp_header("content-length", "100")
        |> Plug.Conn.put_resp_header("content-type", "image/jpeg")
        |> Plug.Conn.put_resp_header("etag", "\"etag\"")
        |> Plug.Conn.send_resp(200, "")
      else
        Plug.Conn.send_resp(conn, 412, "")
      end
    end)

    assert {:error, :upload_object_changed} =
             R2.verify_upload(%{
               storage_key: "profiles/photo",
               content_type: "image/jpeg",
               size_bytes: 100
             })
  end
end
