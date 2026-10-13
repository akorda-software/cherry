defmodule Cherry.Identity.Providers.GoogleJwksCache do
  @moduledoc false

  def get, do: Cherry.Identity.JwksCache.get(__MODULE__, :google_jwks_unavailable)
end
