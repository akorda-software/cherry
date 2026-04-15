defmodule Snack.Identity.Providers.Google do
  @moduledoc false

  alias Snack.Identity.ProviderClaims
  alias Snack.Identity.Providers.JwtVerifier

  def verify(%{"provider_token" => provider_token}), do: verify(%{provider_token: provider_token})

  def verify(%{provider_token: provider_token})
      when is_binary(provider_token) and provider_token != "" do
    with {:ok, %{header: header, claims: claims}} <-
           JwtVerifier.verify(provider_token, Snack.Auth.provider_config(:google)),
         {:ok, subject} <- required_claim(claims, "sub"),
         {:ok, email} <- required_claim(claims, "email") do
      {:ok,
       %ProviderClaims{
         subject: subject,
         email: email,
         display_name: display_name(claims),
         provider_data: %{
           "aud" => claims["aud"],
           "email_verified" => Map.get(claims, "email_verified"),
           "iss" => claims["iss"],
           "kid" => header["kid"]
         }
       }}
    end
  end

  def verify(_params), do: {:error, :invalid_provider_token}

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
