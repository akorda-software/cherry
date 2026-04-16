defmodule SnackWeb.Plugs.VerifyStripeSignature do
  @moduledoc """
  Plug that verifies the Stripe-Signature header on webhook requests.

  Validates HMAC-SHA256 signature using the webhook secret from app env.
  """

  import Plug.Conn

  @signature_tolerance_seconds 300

  @spec init(any()) :: any()
  def init(opts), do: opts

  @spec call(Plug.Conn.t(), any()) :: Plug.Conn.t()
  def call(conn, _opts) do
    with {:ok, signature_header} <- fetch_signature_header(conn),
         {:ok, raw_body} <- fetch_raw_body(conn),
         {:ok, timestamp, expected_sig} <- parse_signature(signature_header),
         :ok <- verify_signature(timestamp, raw_body, expected_sig) do
      conn
    else
      _error ->
        conn
        |> put_status(401)
        |> Phoenix.Controller.json(%{error: "invalid_signature"})
        |> halt()
    end
  end

  defp fetch_signature_header(conn) do
    case Plug.Conn.get_req_header(conn, "stripe-signature") do
      [header | _] -> {:ok, header}
      [] -> {:error, :missing_header}
    end
  end

  defp fetch_raw_body(conn) do
    case conn.private[:raw_body] do
      nil -> {:error, :missing_body}
      body -> {:ok, body}
    end
  end

  defp parse_signature(header) do
    parts =
      header
      |> String.split(",")
      |> Enum.map(fn part ->
        case String.split(part, "=", parts: 2) do
          [key, value] -> {String.trim(key), String.trim(value)}
          _ -> nil
        end
      end)
      |> Enum.reject(&is_nil/1)
      |> Map.new()

    with {:ok, timestamp} <- Map.fetch(parts, "t"),
         {:ok, signature} <- Map.fetch(parts, "v1") do
      {:ok, timestamp, signature}
    else
      :error -> {:error, :malformed_header}
    end
  end

  defp verify_signature(timestamp, payload, expected_signature) do
    with {:ok, parsed_timestamp} <- parse_timestamp(timestamp),
         :ok <- validate_timestamp(parsed_timestamp),
         secret when is_binary(secret) and byte_size(secret) > 0 <- get_webhook_secret() do
      signed_payload = "#{timestamp}.#{payload}"
      computed = compute_hmac(signed_payload, secret)

      if Plug.Crypto.secure_compare(computed, expected_signature) do
        :ok
      else
        {:error, :invalid_signature}
      end
    else
      nil -> {:error, :missing_webhook_secret}
      _error -> {:error, :invalid_signature}
    end
  end

  defp parse_timestamp(timestamp) do
    case Integer.parse(timestamp) do
      {parsed, ""} -> {:ok, parsed}
      _ -> {:error, :invalid_timestamp}
    end
  end

  defp validate_timestamp(timestamp) do
    if abs(System.system_time(:second) - timestamp) <= @signature_tolerance_seconds do
      :ok
    else
      {:error, :stale_timestamp}
    end
  end

  defp compute_hmac(signed_payload, secret) do
    :crypto.mac(:hmac, :sha256, secret, signed_payload)
    |> Base.encode16(case: :lower)
  end

  defp get_webhook_secret do
    stripe_config = Application.get_env(:snack, :stripe, %{})

    case stripe_config do
      config when is_list(config) -> Keyword.get(config, :webhook_secret)
      config when is_map(config) -> Map.get(config, :webhook_secret)
      _ -> nil
    end
  end
end
