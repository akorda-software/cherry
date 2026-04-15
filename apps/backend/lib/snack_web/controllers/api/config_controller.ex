defmodule SnackWeb.Controllers.Api.ConfigController do
  use SnackWeb, :controller

  alias Snack.Features

  def show(conn, _params) do
    features_map =
      Features.list_flags()
      |> Map.new(fn key -> {key, %{enabled: Features.enabled?(key)}} end)

    stripe_config =
      Application.get_env(:snack, :stripe_mobile, %{})
      |> case do
        config when is_list(config) -> Enum.into(config, %{})
        config when is_map(config) -> config
      end

    services =
      case Map.get(stripe_config, :publishable_key) do
        nil ->
          %{}

        publishable_key ->
          %{
            stripe: %{
              publishableKey: publishable_key,
              merchantDisplayName: Map.get(stripe_config, :merchant_display_name, "Snack"),
              merchantIdentifier: Map.get(stripe_config, :merchant_identifier),
              urlScheme: Map.get(stripe_config, :url_scheme)
            }
          }
      end

    json(conn, %{features: features_map, services: services})
  end
end
