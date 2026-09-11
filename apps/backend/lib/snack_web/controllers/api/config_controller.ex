defmodule SnackWeb.Controllers.Api.ConfigController do
  use SnackWeb, :controller

  alias Snack.Features

  def show(conn, _params) do
    features_map =
      Features.list_flags()
      |> Map.new(fn key -> {key, %{enabled: Features.enabled?(key)}} end)

    json(conn, %{features: features_map})
  end
end
