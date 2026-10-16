defmodule Cherry.Notifications.ExpoClient.ReqImpl do
  @moduledoc """
  Production Expo Push API client using Req.
  """

  @behaviour Cherry.Notifications.ExpoClient

  defstruct [
    :base_url,
    :access_token,
    :receive_timeout_ms,
    :batch_size,
    :pool_timeout_ms,
    :connect_timeout_ms
  ]

  def expo_config do
    struct!(__MODULE__, Cherry.Notifications.PushConfig.load())
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
    config = expo_config()

    messages
    |> Enum.chunk_every(config.batch_size)
    |> Enum.reduce_while({:ok, []}, fn chunk, {:ok, tickets} ->
      case send_chunk(chunk, opts, config) do
        {:ok, chunk_tickets} -> {:cont, {:ok, [chunk_tickets | tickets]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, chunks} -> {:ok, chunks |> Enum.reverse() |> List.flatten()}
      error -> error
    end
  end

  defp send_chunk(messages, opts, config) do
    request_opts =
      [
        json: messages,
        headers: request_headers(config),
        receive_timeout: config.receive_timeout_ms,
        finch: [
          pool_timeout: config.pool_timeout_ms,
          conn_opts: [transport_opts: [timeout: config.connect_timeout_ms]]
        ],
        # Oban owns retries; a failing provider must not hold a worker indefinitely.
        retry: false
      ]
      |> Keyword.merge(opts)

    case Req.post(
           "#{String.trim_trailing(config.base_url, "/")}/--/api/v2/push/send",
           request_opts
         ) do
      {:ok, %{status: 200, body: body}} ->
        with {:ok, tickets} <- normalize_tickets(body),
             :ok <- validate_tickets(tickets, length(messages)) do
          {:ok, tickets}
        end

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

  defp validate_tickets(tickets, expected) do
    cond do
      length(tickets) != expected -> {:error, :invalid_ticket_count}
      Enum.all?(tickets, &match?(%{"status" => status} when status in ["ok", "error"], &1)) -> :ok
      true -> {:error, :invalid_ticket}
    end
  end

  defp maybe_put_authorization(headers, nil), do: headers

  defp maybe_put_authorization(headers, access_token),
    do: [{"authorization", "Bearer #{access_token}"} | headers]
end
