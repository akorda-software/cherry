defmodule Cherry.Identity.ProviderClaims do
  @moduledoc false

  @enforce_keys [:subject, :email, :display_name, :provider_data]
  @derive {Inspect, except: [:revocation_credential]}
  defstruct [:subject, :email, :display_name, :provider_data, :revocation_credential, :issued_at]
end
