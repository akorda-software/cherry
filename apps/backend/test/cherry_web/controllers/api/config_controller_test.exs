defmodule CherryWeb.Controllers.Api.ConfigControllerTest do
  use CherryWeb.ConnCase, async: false

  setup do
    original_features = Application.get_env(:cherry, :features)

    on_exit(fn ->
      if original_features do
        Application.put_env(:cherry, :features, original_features)
      else
        Application.delete_env(:cherry, :features)
      end
    end)

    :ok
  end

  describe "GET /api/config" do
    test "returns feature flags with enabled state" do
      Application.put_env(:cherry, :features, dark_mode: true)

      conn = get(build_conn(), "/api/config")

      assert %{
               "features" => %{
                 "dark_mode" => %{"enabled" => true}
               }
             } = json_response(conn, 200)
    end

    test "returns feature flag disabled when explicitly false" do
      Application.put_env(:cherry, :features, dark_mode: false)

      conn = get(build_conn(), "/api/config")

      assert %{
               "features" => %{
                 "dark_mode" => %{"enabled" => false}
               }
             } = json_response(conn, 200)
    end

    test "returns no feature flags when none are configured" do
      Application.delete_env(:cherry, :features)

      conn = get(build_conn(), "/api/config")

      assert %{"features" => %{}} = json_response(conn, 200)
    end

    test "returns multiple feature flags independently" do
      Application.put_env(:cherry, :features, dark_mode: true, beta: false)

      conn = get(build_conn(), "/api/config")
      body = json_response(conn, 200)

      assert body["features"]["dark_mode"]["enabled"] == true
      assert body["features"]["beta"]["enabled"] == false
    end
  end
end
