defmodule Cherry.Identity.AppleCodeExchange do
  @moduledoc false

  def exchange(code, native_client_id \\ nil)

  def exchange(code, native_client_id) when is_binary(code) and byte_size(code) in 1..4096 do
    config = Application.fetch_env!(:cherry, :apple_browser)
    client_id = native_client_id || config[:client_id]
    config = Keyword.put(config, :client_id, client_id)
    form = [grant_type: "authorization_code", code: code, client_id: client_id]

    form =
      if native_client_id, do: form, else: Keyword.put(form, :redirect_uri, config[:redirect_uri])

    with {:ok, secret} <- client_secret(config),
         {:ok, %{status: 200, body: %{"id_token" => token, "refresh_token" => refresh}}}
         when is_binary(token) and is_binary(refresh) and byte_size(refresh) in 1..1024 <-
           request("token", Keyword.put(form, :client_secret, secret)) do
      # Access tokens and provider response/error bodies are never retained.
      {:ok, %{id_token: token, refresh_token: refresh, client_id: client_id}}
    else
      _ -> {:error, :apple_exchange_failed}
    end
  end

  def exchange(_, _), do: {:error, :apple_exchange_failed}

  def revoke(client_id, refresh_token) do
    config = Application.fetch_env!(:cherry, :apple_browser) |> Keyword.put(:client_id, client_id)

    with {:ok, secret} <- client_secret(config),
         {:ok, %{status: 200}} <-
           request("revoke",
             client_id: client_id,
             client_secret: secret,
             token: refresh_token,
             token_type_hint: "refresh_token"
           ) do
      :ok
    else
      _ -> {:error, :apple_revocation_pending}
    end
  end

  defp request(endpoint, form) do
    config = Application.fetch_env!(:cherry, :apple_browser)

    Req.post(
      Keyword.merge(
        [
          url: "https://appleid.apple.com/auth/" <> endpoint,
          form: form,
          retry: false,
          redirect: false,
          receive_timeout: 5_000,
          finch: [pool_timeout: 5_000],
          connect_options: [timeout: 5_000]
        ],
        config[:req_options] || []
      )
    )
  end

  def client_secret(config) do
    now = System.os_time(:second)
    header = %{"alg" => "ES256", "kid" => config[:key_id], "typ" => "JWT"}

    claims = %{
      "iss" => config[:team_id],
      "sub" => config[:client_id],
      "aud" => "https://appleid.apple.com",
      "iat" => now,
      "exp" => now + 300
    }

    signing_input = segment(header) <> "." <> segment(claims)
    der = :public_key.sign(signing_input, :sha256, config[:private_key])
    {:"ECDSA-Sig-Value", r, s} = :public_key.der_decode(:"ECDSA-Sig-Value", der)
    signature = <<r::unsigned-big-integer-size(256), s::unsigned-big-integer-size(256)>>
    {:ok, signing_input <> "." <> Base.url_encode64(signature, padding: false)}
  rescue
    _ -> {:error, :apple_exchange_failed}
  end

  defp segment(value), do: value |> Jason.encode!() |> Base.url_encode64(padding: false)
end
