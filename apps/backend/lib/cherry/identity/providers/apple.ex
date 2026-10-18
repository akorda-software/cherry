defmodule Cherry.Identity.Providers.Apple do
  @moduledoc false

  alias Cherry.Identity.ProviderClaims
  alias Cherry.Identity.Providers.AppleJwksCache
  alias Cherry.Identity.Providers.JwtVerifier

  # Browser grants are not Apple ID tokens. Only the initiating mobile verifier
  # can redeem them, once; browser audiences never widen the native allowlist.
  def verify(%{provider_token: "apple-browser:" <> grant, nonce: verifier}),
    do: Cherry.Identity.AppleBrowser.redeem(grant, verifier)

  def verify(
        %{"provider_token" => provider_token, "id_token" => id_token, "nonce" => nonce} = params
      ) do
    verify(%{
      provider_token: provider_token,
      id_token: id_token,
      nonce: nonce,
      authorization_code: params["authorization_code"]
    })
  end

  def verify(%{"provider_token" => provider_token, "nonce" => nonce} = params) do
    verify(%{
      provider_token: provider_token,
      nonce: nonce,
      authorization_code: params["authorization_code"]
    })
  end

  def verify(%{provider_token: provider_token, id_token: id_token, nonce: nonce} = params)
      when is_binary(provider_token) and provider_token != "" and is_binary(id_token) and
             id_token != "" and
             is_binary(nonce) and nonce != "" do
    verify_native(id_token, nonce, params[:authorization_code])
  end

  def verify(%{provider_token: provider_token, nonce: nonce} = params)
      when is_binary(provider_token) and provider_token != "" and is_binary(nonce) and nonce != "" do
    verify_native(provider_token, nonce, params[:authorization_code])
  end

  def verify(_params), do: {:error, :invalid_provider_token}

  defp verify_native(token, nonce, code) do
    with {:ok, claims} <- verify_identity_token(token, nonce) do
      if Cherry.Identity.AppleBrowser.enabled?() do
        client =
          Enum.find(
            List.wrap(claims.provider_data["aud"]),
            &(&1 in Cherry.Auth.provider_config(:apple)[:audiences])
          )

        with {:ok, tokens} <- Cherry.Identity.AppleCodeExchange.exchange(code, client),
             {:ok, exchanged} <- verify_identity_token(tokens.id_token, nonce),
             true <-
               exchanged.subject == claims.subject and
                 exchanged.provider_data["aud"] == claims.provider_data["aud"] do
          {:ok,
           %{claims | revocation_credential: Cherry.Identity.AppleRevocation.credential(tokens)}}
        else
          {:error, reason} -> {:error, reason}
          _ -> {:error, :invalid_provider_token}
        end
      else
        {:ok, claims}
      end
    end
  end

  def verify_browser(token, expected_nonce) do
    config = Application.get_env(:cherry, :apple_browser, [])

    with true <- config[:enabled] == true,
         {:ok, provider_config} <- provider_config(),
         {:ok, %{header: header, claims: claims}} <-
           JwtVerifier.verify(
             token,
             Keyword.put(provider_config, :audiences, [config[:client_id]])
           ),
         true <- claims["nonce"] == expected_nonce,
         {:ok, subject} <- required_claim(claims, "sub"),
         {:ok, email} <- required_claim(claims, "email") do
      {:ok,
       %ProviderClaims{
         subject: subject,
         email: email,
         display_name: display_name(claims),
         issued_at: claims["iat"],
         provider_data: %{"aud" => claims["aud"], "iss" => claims["iss"], "kid" => header["kid"]}
       }}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_provider_token}
    end
  end

  defp verify_identity_token(token, nonce) do
    with {:ok, provider_config} <- provider_config(),
         {:ok, %{header: header, claims: claims}} <-
           JwtVerifier.verify(token, provider_config),
         :ok <- validate_nonce(claims, nonce),
         {:ok, subject} <- required_claim(claims, "sub"),
         {:ok, email} <- required_claim(claims, "email") do
      {:ok,
       %ProviderClaims{
         subject: subject,
         email: email,
         display_name: display_name(claims),
         issued_at: claims["iat"],
         provider_data: %{
           "aud" => claims["aud"],
           "iss" => claims["iss"],
           "kid" => header["kid"],
           "nonce" => claims["nonce"]
         }
       }}
    end
  end

  defp provider_config do
    provider_config = Cherry.Auth.provider_config(:apple)

    case Keyword.fetch(provider_config, :jwks) do
      {:ok, _jwks} ->
        {:ok, provider_config}

      :error ->
        with {:ok, jwks} <- AppleJwksCache.get() do
          {:ok, Keyword.put(provider_config, :jwks, jwks)}
        end
    end
  end

  defp validate_nonce(claims, nonce) do
    if claims["nonce"] == hash_nonce(nonce) do
      :ok
    else
      {:error, :invalid_nonce}
    end
  end

  defp display_name(claims) do
    case claims["name"] do
      name when is_binary(name) and name != "" -> name
      _name -> claims["email"] |> String.split("@") |> List.first() |> humanize()
    end
  end

  defp required_claim(claims, claim_name) do
    case claims[claim_name] do
      value when is_binary(value) and value != "" -> {:ok, value}
      _value -> {:error, :invalid_provider_token}
    end
  end

  defp hash_nonce(nonce) do
    :sha256
    |> :crypto.hash(nonce)
    |> Base.encode16(case: :lower)
  end

  defp humanize(value) do
    value
    |> String.replace("-", " ")
    |> String.split(" ", trim: true)
    |> Enum.map_join(" ", &String.capitalize/1)
  end
end
