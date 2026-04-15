defmodule Snack.Identity.JwtVerifierTest do
  use ExUnit.Case, async: true

  alias Snack.Identity.Providers.JwtVerifier
  alias Snack.TestSupport.ProviderTokenFactory

  setup do
    signing_key = ProviderTokenFactory.generate_signing_key("jwt-verifier-key")

    verifier_opts =
      ProviderTokenFactory.provider_entry(nil,
        audiences: ["snack-google-client-id"],
        issuers: ["https://accounts.google.com", "accounts.google.com"],
        jwks: [signing_key.jwk]
      )
      |> Keyword.delete(:module)

    {:ok, signing_key: signing_key, verifier_opts: verifier_opts}
  end

  test "returns decoded header and claims for a valid token", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    token = ProviderTokenFactory.google_token!(signing_key, %{"sub" => "jwt-valid-user"})

    assert {:ok, %{header: header, claims: claims}} = JwtVerifier.verify(token, verifier_opts)
    assert header["kid"] == signing_key.kid
    assert claims["sub"] == "jwt-valid-user"
  end

  test "accepts audience lists that include the configured client", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    token =
      ProviderTokenFactory.google_token!(signing_key, %{
        "aud" => ["extra-client", "snack-google-client-id"]
      })

    assert {:ok, _jwt} = JwtVerifier.verify(token, verifier_opts)
  end

  test "rejects tokens from an unexpected issuer", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    token =
      ProviderTokenFactory.google_token!(signing_key, %{"iss" => "https://issuer.example.com"})

    assert {:error, :invalid_issuer} = JwtVerifier.verify(token, verifier_opts)
  end

  test "rejects tokens with an unexpected audience", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    token = ProviderTokenFactory.google_token!(signing_key, %{"aud" => "other-client"})

    assert {:error, :invalid_audience} = JwtVerifier.verify(token, verifier_opts)
  end

  test "rejects tokens that are not valid yet", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    token =
      ProviderTokenFactory.google_token!(signing_key, %{"nbf" => System.os_time(:second) + 120})

    assert {:error, :token_not_yet_valid} = JwtVerifier.verify(token, verifier_opts)
  end

  test "rejects tokens with an unsupported algorithm", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    token =
      ProviderTokenFactory.jwt!(
        signing_key,
        %{
          "iss" => "https://accounts.google.com",
          "aud" => "snack-google-client-id",
          "sub" => "jwt-unsupported-alg",
          "iat" => System.os_time(:second),
          "exp" => System.os_time(:second) + 3600
        },
        %{},
        %{"alg" => "HS256"}
      )

    assert {:error, :invalid_provider_token} = JwtVerifier.verify(token, verifier_opts)
  end

  test "rejects tokens signed with an unexpected key", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    other_key = ProviderTokenFactory.generate_signing_key("other-jwt-key")
    token = ProviderTokenFactory.google_token!(other_key)

    assert {:error, :invalid_provider_token} = JwtVerifier.verify(token, verifier_opts)
    assert signing_key.kid != other_key.kid
  end

  test "rejects tokens with malformed expiration claims", %{
    signing_key: signing_key,
    verifier_opts: verifier_opts
  } do
    token = ProviderTokenFactory.google_token!(signing_key, %{"exp" => "tomorrow"})

    assert {:error, :invalid_provider_token} = JwtVerifier.verify(token, verifier_opts)
  end

  test "rejects malformed JWT payloads", %{verifier_opts: verifier_opts} do
    assert {:error, :invalid_provider_token} = JwtVerifier.verify("broken.token", verifier_opts)
  end
end
