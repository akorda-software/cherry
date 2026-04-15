defmodule Snack.TestSupport.FutureProvider do
  @moduledoc false

  alias Snack.Identity.ProviderClaims

  def verify(%{provider_token: provider_token})
      when is_binary(provider_token) and provider_token != "" do
    {:ok,
     %ProviderClaims{
       subject: provider_token,
       email: provider_token <> "@future.snack.test",
       display_name: "Future " <> String.capitalize(provider_token),
       provider_data: %{"provider_token" => provider_token}
     }}
  end

  def verify(_params), do: {:error, :invalid_provider_token}
end
