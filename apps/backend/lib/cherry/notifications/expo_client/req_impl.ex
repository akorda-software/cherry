defmodule Cherry.Notifications.ExpoClient.ReqImpl do
  @moduledoc """
  Production Expo Push API client using Req.
  """

  @behaviour Cherry.Notifications.ExpoClient

  defstruct [:base_url, :access_token, :receive_timeout_ms]

  @default_base_url "https://exp.host"
  @default_receive_timeout_ms 5_000

  def expo_config do
    config = Application.get_env(:cherry, :expo_push, [])

    %__MODULE__{
      base_url: Keyword.get(config, :base_url, @default_base_url),
      access_token: blank_to_nil(Keyword.get(config, :access_token)),
      receive_timeout_ms: Keyword.get(config, :receive_timeout_ms, @default_receive_timeout_ms)
    }
  end

  def request_headers(config \\ expo_config()) do
    [
      {"accept", "application/json"},
      {"content-type", "application/json"}
    ]
    |> maybe_put_authorization(config.access_token)
  end

  @impl true
  def send_messages([], _opts), do: {:ok, []}

  def send_messages(messages, opts) when is_list(messages) do
    messages
    |> Enum.chunk_every(100)
    |> Enum.reduce_while({:ok, []}, fn chunk, {:ok, tickets} ->
      case send_chunk(chunk, opts) do
        {:ok, chunk_tickets} -> {:cont, {:ok, tickets ++ chunk_tickets}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp send_chunk(messages, _opts) do
    config = expo_config()

    case Req.post(
           "#{String.trim_trailing(config.base_url, "/")}/--/api/v2/push/send",
           json: messages,
           headers: request_headers(config),
           receive_timeout: config.receive_timeout_ms
         ) do
      {:ok, %{status: 200, body: body}} ->
        normalize_tickets(body)

      {:ok, %{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp normalize_tickets(%{"data" => data}) when is_list(data), do: {:ok, data}
  defp normalize_tickets(%{"data" => data}) when is_map(data), do: {:ok, [data]}
  defp normalize_tickets(%{"errors" => errors}), do: {:error, %{errors: errors}}
  defp normalize_tickets(body), do: {:error, {:unexpected_response, body}}

  defp maybe_put_authorization(headers, nil), do: headers

  defp maybe_put_authorization(headers, access_token),
    do: [{"authorization", "Bearer #{access_token}"} | headers]

  defp blank_to_nil(value) when value in [nil, ""], do: nil
  defp blank_to_nil(value), do: value
end
