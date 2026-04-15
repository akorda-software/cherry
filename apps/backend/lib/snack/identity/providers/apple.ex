defmodule Snack.Identity.Providers.Apple do
  @moduledoc false

  alias Snack.Identity.ProviderClaims
  alias Snack.Identity.Providers.JwtVerifier

  def verify(%{"provider_token" => provider_token, "id_token" => id_token, "nonce" => nonce}) do
    verify(%{provider_token: provider_token, id_token: id_token, nonce: nonce})
  end

  def verify(%{"provider_token" => provider_token, "nonce" => nonce}) do
    verify(%{provider_token: provider_token, nonce: nonce})
  end

  def verify(%{provider_token: provider_token, id_token: id_token, nonce: nonce})
      when is_binary(provider_token) and provider_token != "" and is_binary(id_token) and
             id_token != "" and
             is_binary(nonce) and nonce != "" do
    verify_identity_token(id_token, nonce)
  end

  def verify(%{provider_token: provider_token, nonce: nonce})
      when is_binary(provider_token) and provider_token != "" and is_binary(nonce) and nonce != "" do
    verify_identity_token(provider_token, nonce)
  end

  def verify(_params), do: {:error, :invalid_provider_token}

  defp verify_identity_token(token, nonce) do
    with {:ok, %{header: header, claims: claims}} <-
           JwtVerifier.verify(token, Snack.Auth.provider_config(:apple)),
         :ok <- validate_nonce(claims, nonce),
         {:ok, subject} <- required_claim(claims, "sub"),
         {:ok, email} <- required_claim(claims, "email") do
      {:ok,
       %ProviderClaims{
         subject: subject,
         email: email,
         display_name: display_name(claims),
         provider_data: %{
           "aud" => claims["aud"],
           "iss" => claims["iss"],
           "kid" => header["kid"],
           "nonce" => claims["nonce"]
         }
       }}
    end
  end

  defp validate_nonce(claims, nonce) do
    if claims["nonce"] == nonce do
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

  defp humanize(value) do
    value
    |> String.replace("-", " ")
    |> String.split(" ", trim: true)
    |> Enum.map_join(" ", &String.capitalize/1)
  end
end
