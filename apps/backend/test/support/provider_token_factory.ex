defmodule Cherry.TestSupport.ProviderTokenFactory do
  @moduledoc false

  alias Cherry.Identity.Providers.Apple
  alias Cherry.Identity.Providers.Google

  def configure!(extra_providers \\ %{}) do
    previous_auth_config = Application.fetch_env!(:cherry, Cherry.Auth)
    google_key = generate_signing_key("google-test-key")
    apple_key = generate_signing_key("apple-test-key")

    providers =
      %{
        google:
          provider_entry(Google,
            audiences: ["cherry-google-client-id"],
            issuers: ["https://accounts.google.com", "accounts.google.com"],
            jwks: [google_key.jwk]
          ),
        apple:
          provider_entry(Apple,
            audiences: ["cherry-apple-service-id"],
            issuers: ["https://appleid.apple.com"],
            jwks: [apple_key.jwk]
          )
      }
      |> Map.merge(extra_providers)

    Application.put_env(
      :cherry,
      Cherry.Auth,
      Keyword.put(previous_auth_config, :providers, providers)
    )

    %{
      previous_auth_config: previous_auth_config,
      google_key: google_key,
      apple_key: apple_key
    }
  end

  def restore!(%{previous_auth_config: previous_auth_config}) do
    Application.put_env(:cherry, Cherry.Auth, previous_auth_config)
  end

  def google_token!(signing_key, claims_overrides \\ %{}) do
    now = System.os_time(:second)

    jwt!(
      signing_key,
      %{
        "iss" => "https://accounts.google.com",
        "aud" => "cherry-google-client-id",
        "sub" => "google-user-123",
        "email" => "google-user@example.com",
        "name" => "Google User",
        "iat" => now,
        "exp" => now + 3600
      },
      claims_overrides
    )
  end

  def apple_token!(signing_key, nonce, claims_overrides \\ %{}) do
    now = System.os_time(:second)

    jwt!(
      signing_key,
      %{
        "iss" => "https://appleid.apple.com",
        "aud" => "cherry-apple-service-id",
        "sub" => "apple-user-123",
        "email" => "apple-user@example.com",
        "nonce" => hash_nonce(nonce),
        "iat" => now,
        "exp" => now + 3600
      },
      claims_overrides
    )
  end

  def jwt!(signing_key, default_claims, claims_overrides \\ %{}, header_overrides \\ %{}) do
    header =
      Map.merge(%{"alg" => "RS256", "kid" => signing_key.kid, "typ" => "JWT"}, header_overrides)

    claims = Map.merge(default_claims, claims_overrides)
    signing_input = encode_segment(header) <> "." <> encode_segment(claims)

    signature = :public_key.sign(signing_input, :sha256, signing_key.private_key)

    signing_input <> "." <> Base.url_encode64(signature, padding: false)
  end

  def generate_signing_key(kid) do
    private_key = :public_key.generate_key({:rsa, 2048, 65_537})

    {:RSAPrivateKey, :"two-prime", modulus, public_exponent, _, _, _, _, _, _, _} = private_key

    %{
      kid: kid,
      private_key: private_key,
      jwk: %{
        "alg" => "RS256",
        "e" => encode_unsigned(public_exponent),
        "kid" => kid,
        "kty" => "RSA",
        "n" => encode_unsigned(modulus),
        "use" => "sig"
      }
    }
  end

  def provider_entry(module, opts) do
    Keyword.merge([module: module, allowed_algorithms: ["RS256"]], opts)
  end

  defp encode_segment(value) do
    value
    |> Jason.encode!()
    |> Base.url_encode64(padding: false)
  end

  defp encode_unsigned(value) do
    value
    |> :binary.encode_unsigned()
    |> Base.url_encode64(padding: false)
  end

  defp hash_nonce(nonce) do
    :sha256
    |> :crypto.hash(nonce)
    |> Base.encode16(case: :lower)
  end
end
