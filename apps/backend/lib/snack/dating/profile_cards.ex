defmodule Snack.Dating.ProfileCards do
  @moduledoc """
  Carga en lote de los datos que necesitan las cards y el perfil público de
  otras personas, sin N+1 (un número fijo de consultas por lote):

    * `load_media/2`: fotos activas (por posición) y etiquetas positivas activas
      marcadas como `shared` con el viewer (2 consultas).
    * `rows/2`: filas base con las mismas claves que las filas del feed
      (`Snack.Dating.Discovery`) más señales sociales (1 consulta + contexto del viewer).

  Nunca expone coordenadas: solo la distancia en metros para que el serializador
  la aproxime.
  """

  import Ecto.Query

  alias Snack.Accounts.User
  alias Snack.Dating.DiscoveryPreference
  alias Snack.Dating.Profile
  alias Snack.Dating.ProfileLocation
  alias Snack.Dating.ProfilePhoto
  alias Snack.Dating.Tag
  alias Snack.Repo

  @newcomer_days 7
  @unlimited_distance_km 999_999
  @category_order ~w(interests active lifestyle values personality pets relationship)

  @type media :: %{photos: %{optional(Ecto.UUID.t()) => [%ProfilePhoto{}]}, tags: map()}

  @doc """
  Fotos activas y etiquetas positivas (activas) de `profile_ids`.
  Las etiquetas vienen como `{%Tag{}, shared?}` ordenadas: compartidas primero,
  luego categoría (orden canónico del catálogo), `sort_order` y etiqueta.
  """
  @spec load_media(Ecto.UUID.t(), [Ecto.UUID.t()]) :: media()
  def load_media(viewer_id, profile_ids) do
    ids = Enum.uniq(profile_ids)
    %{photos: photos_by_profile(ids), tags: tags_by_profile(viewer_id, ids)}
  end

  @doc "Fotos activas de un perfil en `media`, por posición."
  def photos_for(%{photos: photos}, profile_id), do: Map.get(photos, profile_id, [])

  @doc "Etiquetas `{%Tag{}, shared?}` de un perfil en `media`, ya ordenadas."
  def tags_for(%{tags: tags}, profile_id), do: Map.get(tags, profile_id, [])

  @doc """
  Filas base (mapa `id => fila`) para perfiles arbitrarios vistos por `viewer_id`.

  Claves: las del feed (`id`, `display_name`, `birth_date`, `gender`,
  `what_i_am_looking_for`, `bio`, `distance_m`, `score`) más `profile`
  (struct completo), `user_deleted_at`, `liked_viewer`, `viewer_liked`,
  `blocked`, `is_newcomer` y `beyond_preferred_distance`.
  `distance_m` es `nil` si falta alguna de las dos ubicaciones.
  """
  @spec rows(Ecto.UUID.t(), [Ecto.UUID.t()], DateTime.t()) :: %{optional(Ecto.UUID.t()) => map()}
  def rows(viewer_id, profile_ids, now \\ DateTime.utc_now())

  def rows(_viewer_id, [], _now), do: %{}

  def rows(viewer_id, profile_ids, now) do
    viewer = viewer_context(viewer_id)
    ids = Enum.uniq(profile_ids)

    from(p in Profile,
      join: u in User,
      on: u.id == p.user_id,
      left_join: pl in ProfileLocation,
      on: pl.profile_id == p.id,
      where: p.id in ^ids,
      select: %{
        profile: p,
        user_deleted_at: u.deleted_at,
        liked_viewer:
          fragment(
            "EXISTS (SELECT 1 FROM swipe_actions s WHERE s.actor_profile_id = ? AND s.target_profile_id = ? AND s.action_type = 'like')",
            p.id,
            type(^viewer_id, :binary_id)
          ),
        viewer_liked:
          fragment(
            "EXISTS (SELECT 1 FROM swipe_actions s WHERE s.actor_profile_id = ? AND s.target_profile_id = ? AND s.action_type = 'like')",
            type(^viewer_id, :binary_id),
            p.id
          ),
        blocked:
          fragment(
            "EXISTS (SELECT 1 FROM user_blocks b WHERE (b.actor_profile_id = ? AND b.target_profile_id = ?) OR (b.actor_profile_id = ? AND b.target_profile_id = ?))",
            p.id,
            type(^viewer_id, :binary_id),
            type(^viewer_id, :binary_id),
            p.id
          )
      }
    )
    |> select_distance(viewer.point)
    |> Repo.all()
    |> Map.new(fn row -> {row.profile.id, build_row(row, viewer, now)} end)
  end

  @doc """
  ¿Es un perfil recién llegado? Misma regla que el feed (`Snack.Dating.Discovery`):
  `completed_at` en los últimos #{@newcomer_days} días.
  """
  def newcomer?(%Profile{} = profile, now \\ DateTime.utc_now()) do
    # `inserted_at` only as a fallback for schemas without `completed_at`.
    since =
      if Map.has_key?(profile, :completed_at),
        do: Map.get(profile, :completed_at),
        else: profile.inserted_at

    cutoff = DateTime.add(now, -@newcomer_days, :day)
    since != nil and DateTime.compare(since, cutoff) == :gt
  end

  # ── Internals ──────────────────────────────────────────────────────────

  defp photos_by_profile([]), do: %{}

  defp photos_by_profile(ids) do
    from(ph in ProfilePhoto,
      where: ph.profile_id in ^ids and ph.is_active == true,
      order_by: [asc: ph.profile_id, asc: ph.position]
    )
    |> Repo.all()
    |> Enum.group_by(& &1.profile_id)
  end

  defp tags_by_profile(_viewer_id, []), do: %{}

  defp tags_by_profile(viewer_id, ids) do
    from(t in Tag,
      join: pt in "profile_tags",
      on: pt.tag_id == t.id,
      left_join: vt in "profile_tags",
      on: vt.tag_id == t.id and vt.profile_id == type(^viewer_id, :binary_id),
      where: pt.profile_id in type(^ids, {:array, :binary_id}) and t.is_active == true,
      select: {type(pt.profile_id, :binary_id), t, not is_nil(vt.tag_id)}
    )
    |> Repo.all()
    |> Enum.group_by(&elem(&1, 0), fn {profile_id, tag, shared} ->
      # A profile never "shares" tags with itself (self preview).
      {tag, shared and profile_id != viewer_id}
    end)
    |> Map.new(fn {profile_id, tags} -> {profile_id, sort_tags(tags)} end)
  end

  defp sort_tags(tags) do
    Enum.sort_by(tags, fn {tag, shared} ->
      {if(shared, do: 0, else: 1), category_rank(tag.category), tag.sort_order || 0, tag.label}
    end)
  end

  defp category_rank(category) do
    Enum.find_index(@category_order, &(&1 == category)) || length(@category_order)
  end

  defp viewer_context(viewer_id) do
    Repo.one(
      from(p in Profile,
        left_join: pl in ProfileLocation,
        on: pl.profile_id == p.id,
        left_join: dp in DiscoveryPreference,
        on: dp.profile_id == p.id,
        where: p.id == ^viewer_id,
        select: %{point: pl.coordinates, distance_km: dp.distance_km}
      )
    ) || %{point: nil, distance_km: nil}
  end

  defp select_distance(query, nil), do: select_merge(query, %{distance_m: nil})

  defp select_distance(query, point) do
    select_merge(query, [_p, _u, pl], %{
      distance_m: fragment("ST_Distance(?::geography, ?::geography)", pl.coordinates, ^point)
    })
  end

  defp build_row(row, viewer, now) do
    profile = row.profile

    %{
      id: profile.id,
      display_name: profile.display_name,
      birth_date: profile.birth_date,
      gender: profile.gender,
      what_i_am_looking_for: profile.what_i_am_looking_for,
      bio: profile.bio,
      distance_m: row.distance_m,
      score: 0,
      profile: profile,
      user_deleted_at: row.user_deleted_at,
      liked_viewer: row.liked_viewer,
      viewer_liked: row.viewer_liked,
      blocked: row.blocked,
      is_newcomer: newcomer?(profile, now),
      beyond_preferred_distance: beyond_preferred_distance?(row.distance_m, viewer.distance_km)
    }
  end

  defp beyond_preferred_distance?(distance_m, distance_km)
       when is_number(distance_m) and is_integer(distance_km) and
              distance_km < @unlimited_distance_km,
       do: distance_m > distance_km * 1000

  defp beyond_preferred_distance?(_distance_m, _distance_km), do: false
end
