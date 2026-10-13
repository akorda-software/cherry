defmodule Cherry.Identity.Providers.AppleJwksCache do
  @moduledoc false

  def get, do: Cherry.Identity.JwksCache.get(__MODULE__, :apple_jwks_unavailable)
end
