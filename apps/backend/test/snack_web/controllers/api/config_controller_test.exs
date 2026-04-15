defmodule SnackWeb.Controllers.Api.ConfigControllerTest do
  use SnackWeb.ConnCase, async: false

  setup do
    original_features = Application.get_env(:snack, :features)
    original_stripe_mobile = Application.get_env(:snack, :stripe_mobile)

    on_exit(fn ->
      if original_features do
        Application.put_env(:snack, :features, original_features)
      else
        Application.delete_env(:snack, :features)
      end

      if original_stripe_mobile do
        Application.put_env(:snack, :stripe_mobile, original_stripe_mobile)
      else
        Application.delete_env(:snack, :stripe_mobile)
      end
    end)

    :ok
  end

  describe "GET /api/config" do
    test "returns stripe mobile runtime config when configured" do
      Application.put_env(:snack, :features, subscriptions: true)

      Application.put_env(:snack, :stripe_mobile, %{
        publishable_key: "pk_test_runtime",
        merchant_display_name: "Snack Test",
        merchant_identifier: "merchant.snack.test",
        url_scheme: "snack"
      })

      conn = get(build_conn(), "/api/config")

      assert %{
               "services" => %{
                 "stripe" => %{
                   "publishableKey" => "pk_test_runtime",
                   "merchantDisplayName" => "Snack Test",
                   "merchantIdentifier" => "merchant.snack.test",
                   "urlScheme" => "snack"
                 }
               }
             } = json_response(conn, 200)
    end

    test "returns subscriptions enabled: true when flag is set" do
      Application.put_env(:snack, :features, subscriptions: true)

      conn = get(build_conn(), "/api/config")

      assert %{
               "features" => %{
                 "subscriptions" => %{"enabled" => true}
               }
             } = json_response(conn, 200)
    end

    test "returns subscriptions enabled: false when flag is explicitly false" do
      Application.put_env(:snack, :features, subscriptions: false)

      conn = get(build_conn(), "/api/config")

      assert %{
               "features" => %{
                 "subscriptions" => %{"enabled" => false}
               }
             } = json_response(conn, 200)
    end

    test "returns subscriptions enabled: false when flag is absent" do
      Application.delete_env(:snack, :features)

      conn = get(build_conn(), "/api/config")

      assert %{
               "features" => %{
                 "subscriptions" => %{"enabled" => false}
               }
             } = json_response(conn, 200)
    end

    test "returns multiple feature flags independently" do
      Application.put_env(:snack, :features, subscriptions: true, dark_mode: true, beta: false)

      conn = get(build_conn(), "/api/config")
      body = json_response(conn, 200)

      assert body["features"]["subscriptions"]["enabled"] == true
      assert body["features"]["dark_mode"]["enabled"] == true
      assert body["features"]["beta"]["enabled"] == false
    end
  end
end
