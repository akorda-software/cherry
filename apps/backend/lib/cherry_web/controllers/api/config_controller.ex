defmodule CherryWeb.Controllers.Api.ConfigController do
  @moduledoc """
  `GET /api/config` (public): feature flags, the identity of the instance
  (`Cherry.Instance`) and the minimum age, so one app build can talk to any
  instance.
  """
  use CherryWeb, :controller

  alias Cherry.Features
  alias Cherry.Identity.AgeVerifications

  def show(conn, _params) do
    features_map =
      Features.list_flags()
      |> Map.new(fn key -> {key, %{enabled: Features.enabled?(key)}} end)

    instance = Cherry.Instance.info()

    json(conn, %{
      features: features_map,
      instance: %{
        name: instance.name,
        country: instance.country,
        locale: instance.locale,
        operator: instance.operator,
        contactEmail: instance.contact_email,
        privacyUrl: instance.privacy_url || CherryWeb.Endpoint.url() <> "/privacidad",
        termsUrl: instance.terms_url || CherryWeb.Endpoint.url() <> "/condiciones",
        sourceUrl: instance.source_url
      },
      ageVerification: %{minimumAge: AgeVerifications.minimum_age()}
    })
  end
end
