defmodule Cherry.Notifications.PushConfig do
  @moduledoc "Validated technical limits for push transport; no product or permission rules."

  def load(config \\ Application.get_env(:cherry, :expo_push, [])) do
    %{
      base_url: Keyword.get(config, :base_url, "https://exp.host"),
      access_token: blank_to_nil(Keyword.get(config, :access_token)),
      batch_size: positive!(config, :batch_size, 100, 100),
      receive_timeout_ms: positive!(config, :receive_timeout_ms, 5_000, 15_000),
      pool_timeout_ms: positive!(config, :pool_timeout_ms, 5_000, 15_000),
      connect_timeout_ms: positive!(config, :connect_timeout_ms, 5_000, 15_000)
    }
  end

  defp positive!(config, key, default, maximum) do
    case Keyword.get(config, key, default) do
      value when is_integer(value) and value > 0 and value <= maximum -> value
      _ -> raise ArgumentError, "expo_push #{key} must be an integer between 1 and #{maximum}"
    end
  end

  defp blank_to_nil(value) when value in [nil, ""], do: nil
  defp blank_to_nil(value), do: value
end
