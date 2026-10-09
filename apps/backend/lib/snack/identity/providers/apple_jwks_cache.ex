defmodule Snack.Identity.Providers.AppleJwksCache do
  @moduledoc false

  def get, do: Snack.Identity.JwksCache.get(__MODULE__, :apple_jwks_unavailable)
end
