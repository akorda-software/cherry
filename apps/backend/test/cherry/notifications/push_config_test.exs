defmodule Cherry.Notifications.PushConfigTest do
  use ExUnit.Case, async: true

  alias Cherry.Notifications.PushConfig

  test "transport defaults remain unchanged" do
    assert %{
             base_url: "https://exp.host",
             access_token: nil,
             batch_size: 100,
             receive_timeout_ms: 5_000,
             pool_timeout_ms: 5_000,
             connect_timeout_ms: 5_000
           } = PushConfig.load([])
  end

  test "manual transport limits validate their type and provider bounds" do
    for {key, maximum} <- [
          batch_size: 100,
          receive_timeout_ms: 15_000,
          pool_timeout_ms: 15_000,
          connect_timeout_ms: 15_000
        ] do
      for value <- [nil, 0, -1, maximum + 1, "1", 1.5] do
        assert_raise ArgumentError, ~r/#{key} must be an integer/, fn ->
          PushConfig.load([{key, value}])
        end
      end

      assert Map.fetch!(PushConfig.load([{key, 1}]), key) == 1
      assert Map.fetch!(PushConfig.load([{key, maximum}]), key) == maximum
    end
  end
end
