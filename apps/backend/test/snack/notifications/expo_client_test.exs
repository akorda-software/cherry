defmodule Snack.Notifications.ExpoClientTest do
  use ExUnit.Case, async: true

  alias Snack.Notifications.ExpoClient
  alias Snack.Notifications.ExpoClient.ReqImpl

  describe "behaviour conformance" do
    test "MockExpoClient implements all ExpoClient callbacks" do
      assert Code.ensure_loaded?(Snack.Notifications.MockExpoClient)

      behaviours = ExpoClient.behaviour_info(:callbacks)

      for {fun, arity} <- behaviours do
        assert function_exported?(Snack.Notifications.MockExpoClient, fun, arity),
               "MockExpoClient missing callback: #{fun}/#{arity}"
      end
    end
  end

  describe "ReqImpl.request_headers/1" do
    test "adds authorization when an Expo access token is configured" do
      headers =
        ReqImpl.request_headers(%ReqImpl{
          base_url: "https://example.com",
          access_token: "expo-secret",
          receive_timeout_ms: 1_000
        })

      assert {"authorization", "Bearer expo-secret"} in headers
      assert {"accept", "application/json"} in headers
      assert {"content-type", "application/json"} in headers
    end

    test "omits authorization when no Expo access token is configured" do
      headers =
        ReqImpl.request_headers(%ReqImpl{
          base_url: "https://example.com",
          access_token: nil,
          receive_timeout_ms: 1_000
        })

      refute Enum.any?(headers, fn {name, _value} -> name == "authorization" end)
    end
  end
end
