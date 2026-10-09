defmodule Snack.Identity.Providers.GoogleJwksCache do
  @moduledoc false

  def get, do: Snack.Identity.JwksCache.get(__MODULE__, :google_jwks_unavailable)
end
