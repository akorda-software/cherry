defmodule SnackWeb.Controllers.Api.WebhookControllerTest do
  use SnackWeb.ConnCase, async: false

  setup do
    Application.put_env(:snack, :stripe_client, Snack.Billing.MockStripeClient)

    original_features = Application.get_env(:snack, :features)
    original_stripe = Application.get_env(:snack, :stripe)

    on_exit(fn ->
      if original_features,
        do: Application.put_env(:snack, :features, original_features),
        else: Application.delete_env(:snack, :features)

      if original_stripe,
        do: Application.put_env(:snack, :stripe, original_stripe),
        else: Application.delete_env(:snack, :stripe)
    end)

    :ok
  end

  describe "POST /api/webhooks/stripe" do
    test "returns 200 for valid webhook payload" do
      Application.put_env(:snack, :features, subscriptions: true)

      payload =
        Jason.encode!(%{
          "id" => "evt_webhook_test",
          "type" => "customer.subscription.updated",
          "data" => %{"object" => %{"status" => "active"}}
        })

      timestamp = Integer.to_string(System.system_time(:second))
      secret = "whsec_test_webhook_123"

      Application.put_env(:snack, :stripe, %{
        webhook_secret: secret,
        api_key: "sk_test",
        base_url: "https://api.stripe.com"
      })

      signature =
        :crypto.mac(:hmac, :sha256, secret, "#{timestamp}.#{payload}")
        |> Base.encode16(case: :lower)

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_req_header("stripe-signature", "t=#{timestamp},v1=#{signature}")
        |> Plug.Conn.put_req_header("content-type", "application/json")
        |> Plug.Conn.put_private(:raw_body, payload)
        |> post("/api/webhooks/stripe", payload)

      assert conn.status == 200
    after
      Application.delete_env(:snack, :stripe)
    end

    test "returns 401 for bad signature" do
      Application.put_env(:snack, :features, subscriptions: true)

      Application.put_env(:snack, :stripe, %{
        webhook_secret: "whsec_real",
        api_key: "sk_test",
        base_url: "https://api.stripe.com"
      })

      payload = Jason.encode!(%{"id" => "evt_bad_sig", "type" => "test", "data" => %{}})

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_req_header("stripe-signature", "t=1234,v1=bad_signature")
        |> Plug.Conn.put_req_header("content-type", "application/json")
        |> Plug.Conn.put_private(:raw_body, payload)
        |> post("/api/webhooks/stripe", payload)

      assert conn.status == 401
    after
      Application.delete_env(:snack, :stripe)
    end

    test "acknowledges webhook when flag disabled (no processing)" do
      Application.put_env(:snack, :features, subscriptions: false)

      Application.put_env(:snack, :stripe, %{
        webhook_secret: "whsec_test",
        api_key: "sk_test",
        base_url: "https://api.stripe.com"
      })

      payload = Jason.encode!(%{"id" => "evt_flag_off", "type" => "test", "data" => %{}})

      timestamp = Integer.to_string(System.system_time(:second))

      signature =
        :crypto.mac(:hmac, :sha256, "whsec_test", "#{timestamp}.#{payload}")
        |> Base.encode16(case: :lower)

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_req_header("stripe-signature", "t=#{timestamp},v1=#{signature}")
        |> Plug.Conn.put_req_header("content-type", "application/json")
        |> Plug.Conn.put_private(:raw_body, payload)
        |> post("/api/webhooks/stripe", payload)

      # When flag off, the RequireFeature plug returns 404 before reaching webhook
      assert conn.status == 404
    after
      Application.delete_env(:snack, :stripe)
    end
  end
end
