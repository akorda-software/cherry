defmodule SnackWeb.Plugs.VerifyStripeSignatureTest do
  use SnackWeb.ConnCase, async: false

  alias SnackWeb.Plugs.VerifyStripeSignature

  @webhook_secret "whsec_test_secret_key_12345"
  @test_payload ~s({"id":"evt_test","type":"test.event"})
  setup do
    original = Application.get_env(:snack, :stripe)

    Application.put_env(:snack, :stripe, %{
      webhook_secret: @webhook_secret,
      api_key: "sk_test",
      base_url: "https://api.stripe.com"
    })

    on_exit(fn ->
      if original,
        do: Application.put_env(:snack, :stripe, original),
        else: Application.delete_env(:snack, :stripe)
    end)

    :ok
  end

  describe "call/2" do
    test "passes through with valid signature" do
      timestamp = Integer.to_string(System.system_time(:second))
      signature = compute_signature(timestamp, @test_payload, @webhook_secret)
      header = "t=#{timestamp},v1=#{signature}"

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_req_header("stripe-signature", header)
        |> Plug.Conn.put_private(:raw_body, @test_payload)
        |> VerifyStripeSignature.call([])

      assert conn.halted == false
    end

    test "halts with 401 for invalid signature" do
      timestamp = Integer.to_string(System.system_time(:second))

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_req_header(
          "stripe-signature",
          "t=#{timestamp},v1=invalid_signature"
        )
        |> Plug.Conn.put_private(:raw_body, @test_payload)
        |> VerifyStripeSignature.call([])

      assert conn.halted == true
      assert conn.status == 401
    end

    test "halts with 401 when signature header is missing" do
      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_private(:raw_body, @test_payload)
        |> VerifyStripeSignature.call([])

      assert conn.halted == true
      assert conn.status == 401
    end

    test "halts with 401 for stale timestamp even with valid signature" do
      stale_timestamp = Integer.to_string(System.system_time(:second) - 301)
      signature = compute_signature(stale_timestamp, @test_payload, @webhook_secret)

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_req_header(
          "stripe-signature",
          "t=#{stale_timestamp},v1=#{signature}"
        )
        |> Plug.Conn.put_private(:raw_body, @test_payload)
        |> VerifyStripeSignature.call([])

      assert conn.halted == true
      assert conn.status == 401
    end
  end

  defp compute_signature(timestamp, payload, secret) do
    signed_payload = "#{timestamp}.#{payload}"

    :crypto.mac(:hmac, :sha256, secret, signed_payload)
    |> Base.encode16(case: :lower)
  end
end
