defmodule CherryWeb.ProfileCardJSON do
  @moduledoc """
  Serializadores de perfiles de OTRAS personas: la card de discovery (feed,
  likes recibidos, deshacer) y el perfil público. Mismas fotos/etiquetas vía
  `CherryWeb.DatingJSON`; distancia siempre aproximada, nunca coordenadas.
  """

  alias Cherry.Dating.Profile
  alias Cherry.Dating.ProfileCards
  alias CherryWeb.DatingJSON
  alias CherryWeb.MediaUrl

  @doc """
  Card (`DiscoveryProfileCard`). `row` usa las claves de las filas del feed; las
  claves sociales (`liked_viewer`, `is_newcomer`, `beyond_preferred_distance`)
  son opcionales para funcionar con filas de cualquier origen. Nunca incluye la
  puntuación del ranking: delata señales privadas (actividad, likes pendientes).
  """
  def card(conn, row, media) do
    photos = ProfileCards.photos_for(media, row.id)
    tags = ProfileCards.tags_for(media, row.id)
    distance_m = Map.get(row, :distance_m)
    primary_photo_url = primary_photo_url(conn, photos, row)

    %{
      id: row.id,
      displayName: row.display_name,
      age: Profile.age(%{birth_date: row.birth_date}),
      bio: row.bio,
      gender: row.gender,
      lookingFor: row.looking_for || [],
      # Deprecated: first intent, for app builds before multi-intent.
      whatIAmLookingFor: legacy_intent(row.looking_for),
      distanceLabel: distance_label(distance_m),
      distanceKmApprox: approximate_distance_km(distance_m),
      sharedTagsCount: Map.get(row, :shared_tags_count) || Enum.count(tags, &elem(&1, 1)),
      photoUrl: primary_photo_url,
      photoCount: photo_count(photos, row),
      photos: Enum.map(photos, &DatingJSON.photo_summary(conn, &1)),
      tags: Enum.map(tags, fn {tag, shared} -> DatingJSON.tag(tag, shared: shared) end),
      likedYou: Map.get(row, :liked_viewer, false) == true,
      isNewcomer: Map.get(row, :is_newcomer, false) == true,
      beyondPreferredDistance: Map.get(row, :beyond_preferred_distance, false) == true
    }
  end

  @doc "Perfil público (`PublicProfile`). `match` = `%{id, conversation_id}` o `nil`."
  def public_profile(conn, row, media, match) do
    photos = ProfileCards.photos_for(media, row.id)
    tags = ProfileCards.tags_for(media, row.id)
    distance_m = Map.get(row, :distance_m)

    %{
      id: row.id,
      displayName: row.display_name,
      age: Profile.age(%{birth_date: row.birth_date}),
      bio: row.bio,
      gender: row.gender,
      lookingFor: row.looking_for || [],
      # Deprecated: first intent, for app builds before multi-intent.
      whatIAmLookingFor: legacy_intent(row.looking_for),
      distanceLabel: distance_label(distance_m),
      distanceKmApprox: approximate_distance_km(distance_m),
      photos: Enum.map(photos, &DatingJSON.photo_summary(conn, &1)),
      tags: Enum.map(tags, fn {tag, shared} -> DatingJSON.tag(tag, shared: shared) end),
      likedYou: row.liked_viewer == true,
      youLiked: row.viewer_liked == true,
      matchId: match && match.id,
      conversationId: match && match.conversation_id,
      isNewcomer: row.is_newcomer == true
    }
  end

  @doc """
  Valor del campo obsoleto `whatIAmLookingFor`: la primera intención (en orden
  canónico) de `looking_for`, o `nil`. Solo para versiones de la app anteriores
  a la elección múltiple.
  """
  def legacy_intent([first | _rest]), do: first
  def legacy_intent(_looking_for), do: nil

  @doc """
  Etiqueta de distancia aproximada: `<2 km` «Cerca de ti»; 2–10 km redondeo a
  1 km; 10–50 a 5 km; 50–100 a 10 km; más de 100 «A más de N km» (grano 25 km).
  `nil` si no hay distancia.
  """
  def distance_label(nil), do: nil

  def distance_label(distance_meters) do
    distance_km = distance_meters / 1000

    cond do
      distance_km < 2 -> "Cerca de ti"
      distance_km < 10 -> "A unos #{round(distance_km)} km"
      distance_km < 50 -> "A unos #{round_to_nearest(distance_km, 5)} km"
      distance_km < 100 -> "A unos #{round_to_nearest(distance_km, 10)} km"
      true -> "A más de #{round_to_nearest(distance_km, 25)} km"
    end
  end

  @doc "Distancia aproximada en km con el mismo grano que `distance_label/1` (`nil` si no hay)."
  def approximate_distance_km(nil), do: nil

  def approximate_distance_km(distance_meters) do
    distance_km = distance_meters / 1000

    cond do
      distance_km < 2 -> max(1, round(distance_km))
      distance_km < 10 -> round(distance_km)
      distance_km < 50 -> round_to_nearest(distance_km, 5)
      distance_km < 100 -> round_to_nearest(distance_km, 10)
      true -> round_to_nearest(distance_km, 25)
    end
  end

  defp round_to_nearest(value, step) do
    value
    |> Kernel./(step)
    |> round()
    |> Kernel.*(step)
  end

  defp primary_photo_url(conn, [first | _photos], _row), do: MediaUrl.absolute(conn, first.url)

  defp primary_photo_url(conn, [], row),
    do: MediaUrl.absolute(conn, Map.get(row, :primary_photo_url))

  defp photo_count([], row), do: Map.get(row, :photo_count) || 0
  defp photo_count(photos, _row), do: length(photos)
end
