defmodule Snack.Notifications.ExpoClientTest do
  use ExUnit.Case, async: false

  alias Snack.Notifications.ExpoClient
  alias Snack.Notifications.ExpoClient.ReqImpl

  test "connection and pool timeouts work through the real HTTP transport" do
    server =
      start_supervised!(
        {Bandit,
         plug: fn conn, _opts ->
           Req.Test.json(conn, %{data: [%{status: "ok", id: "wire-ticket"}]})
         end,
         ip: {127, 0, 0, 1},
         port: 0,
         startup_log: false}
      )

    {:ok, {_ip, port}} = ThousandIsland.listener_info(server)
    previous = Application.fetch_env!(:snack, :expo_push)
    Application.put_env(:snack, :expo_push, base_url: "http://127.0.0.1:#{port}")
    on_exit(fn -> Application.put_env(:snack, :expo_push, previous) end)

    assert {:ok, [%{"id" => "wire-ticket"}]} = ReqImpl.send_messages([%{"to" => "synthetic"}], [])
  end

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

  test "batches of 100 preserve ticket order and don't retry HTTP in the worker" do
    Req.Test.stub(__MODULE__, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      messages = Jason.decode!(body)
      send(self(), {:batch_size, length(messages)})
      Req.Test.json(conn, %{data: Enum.map(messages, &%{status: "ok", id: &1["to"]})})
    end)

    messages = for i <- 1..205, do: %{"to" => "token-#{i}"}
    assert {:ok, tickets} = ReqImpl.send_messages(messages, plug: {Req.Test, __MODULE__})
    assert Enum.map(tickets, & &1["id"]) == Enum.map(messages, & &1["to"])
    assert_received {:batch_size, 100}
    assert_received {:batch_size, 100}
    assert_received {:batch_size, 5}
  end

  test "mismatched ticket counts are retried as a delivery failure" do
    Req.Test.stub(__MODULE__, fn conn -> Req.Test.json(conn, %{data: []}) end)

    assert {:error, :invalid_ticket_count} =
             ReqImpl.send_messages([%{"to" => "test"}], plug: {Req.Test, __MODULE__})
  end

  test "malformed tickets cannot be mistaken for an accepted delivery" do
    Req.Test.stub(__MODULE__, fn conn -> Req.Test.json(conn, %{data: [nil]}) end)

    assert {:error, :invalid_ticket} =
             ReqImpl.send_messages([%{"to" => "test"}], plug: {Req.Test, __MODULE__})
  end
end
