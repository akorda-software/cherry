defmodule Cherry.Storage.R2Test do
  use ExUnit.Case, async: false
  alias Cherry.Storage.R2

  setup do
    previous = Application.get_env(:cherry, R2)

    Application.put_env(:cherry, R2,
      account_id: "account",
      bucket_name: "bucket",
      access_key_id: "access",
      secret_access_key: "secret",
      public_url_base: "https://cdn.test",
      request_options: [plug: {Req.Test, R2}]
    )

    on_exit(fn -> Application.put_env(:cherry, R2, previous) end)
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
