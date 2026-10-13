defmodule CherryWeb.Onboarding do
  @moduledoc """
  Paso de onboarding sugerido al móvil a partir de los campos que faltan
  (`Cherry.Dating.profile_completion_missing/1`). Conveniencia de routing, no
  frontera de seguridad.
  """

  alias Cherry.Dating
  alias Cherry.Dating.Profile

  @steps [
    display_name: "name",
    birth_date: "birth_date",
    gender: "gender",
    looking_for: "intent",
    bio: "bio",
    photos: "photos",
    interested_in: "interested_in",
    discovery_preferences: "discovery_preferences",
    tags: "tags",
    location: "location"
  ]

  @doc "Primer paso pendiente según la lista `missing` (en orden), o `nil`."
  def next_step([field | _missing]), do: Keyword.get(@steps, field)
  def next_step(_missing), do: nil

  @doc "`{complete?, next_step}` de un perfil existente."
  def state(%Profile{} = profile) do
    missing = Dating.profile_completion_missing(profile)
    {missing == [], next_step(missing)}
  end
end
