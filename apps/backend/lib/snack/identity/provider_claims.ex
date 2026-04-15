defmodule Snack.Identity.ProviderClaims do
  @moduledoc false

  @enforce_keys [:subject, :email, :display_name, :provider_data]
  defstruct [:subject, :email, :display_name, :provider_data]
end
