defmodule Cherry.Identity.AppleRevocation do
  @moduledoc "Encrypted, minimal Apple revocation instructions; never a user, email or Apple subject."
  alias Cherry.Identity.AppleCodeExchange

  def credential(%{refresh_token: token, client_id: client}) do
    Cherry.Crypto.encrypt!(
      Jason.encode!(%{
        "purpose" => "apple-revocation-v1",
        "client_id" => client,
        "token" => token
      })
    )
  end

  def merge(existing, nil), do: existing || %{}

  def merge(existing, encrypted) do
    case decode(encrypted) do
      {:ok, client, _token} -> Map.put(existing || %{}, client, encrypted)
      _ -> raise ArgumentError, "Invalid encrypted Apple credential"
    end
  end

  def revoke(encrypted) do
    with {:ok, client, token} <- decode(encrypted) do
      AppleCodeExchange.revoke(client, token)
    else
      _ -> {:error, :apple_revocation_pending}
    end
  rescue
    _ -> {:error, :apple_revocation_pending}
  end

  defp decode("v1:" <> _ = encrypted) do
    with {:ok, json} <- Cherry.Crypto.decrypt(encrypted),
         {:ok, %{"purpose" => "apple-revocation-v1", "client_id" => client, "token" => token}} <-
           Jason.decode(json),
         true <- is_binary(client) and byte_size(client) in 1..255,
         true <- is_binary(token) and byte_size(token) in 1..1024 do
      {:ok, client, token}
    else
      _ -> {:error, :apple_revocation_pending}
    end
  rescue
    _ -> {:error, :apple_revocation_pending}
  end

  defp decode(_), do: {:error, :apple_revocation_pending}
end
