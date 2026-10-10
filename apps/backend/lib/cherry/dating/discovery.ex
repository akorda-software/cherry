defmodule Cherry.Dating.Discovery do
  @moduledoc "SQL-ranked discovery with a stable score/UUID cursor scoped to the viewer."
  import Ecto.Query
  alias Cherry.Repo
  alias Cherry.Dating.{Profile, DiscoveryPreference, ProfileLocation, SwipeAction, UserBlock}

  @cursor_salt "discovery-v1"

  def feed(viewer_profile_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    with true <- is_integer(limit) and limit in 1..100,
         {:ok, cursor} <- decode_cursor(Keyword.get(opts, :cursor), viewer_profile_id) do
      fetch_page(viewer_profile_id, limit, cursor)
    else
      false -> {:error, :invalid_limit}
      error -> error
    end
  end

  defp fetch_page(viewer_profile_id, limit, cursor) do
    viewer =
      Repo.get!(Profile, viewer_profile_id)
      |> Repo.preload([:discovery_preference, :location, :tags, :blocked_tags])

    viewer_prefs = viewer.discovery_preference
    viewer_location = viewer.location
    viewer_tag_ids = Enum.map(viewer.tags, & &1.id)
    blocked_tag_ids = Enum.map(viewer.blocked_tags, & &1.id)
    as_of = if cursor, do: cursor.at, else: DateTime.utc_now() |> DateTime.truncate(:second)
    active_since = DateTime.add(as_of, -7, :day)

    if viewer_prefs == nil or viewer_location == nil or Profile.age(viewer) == nil do
      {:ok, %{profiles: [], next_cursor: nil}}
    else
      point = viewer_location.coordinates
      distance_meters = viewer_prefs.distance_km * 1000

      swiped_subquery =
        from s in SwipeAction,
          where: s.actor_profile_id == ^viewer_profile_id,
          select: s.target_profile_id

      blocked_by_viewer_subquery =
        from b in UserBlock,
          where: b.actor_profile_id == ^viewer_profile_id,
          select: b.target_profile_id

      blocked_by_them_subquery =
        from b in UserBlock,
          where: b.target_profile_id == ^viewer_profile_id,
          select: b.actor_profile_id

      blocked_tag_profiles =
        from pt in "profile_tags",
          where: type(pt.tag_id, :binary_id) in ^blocked_tag_ids,
          select: type(pt.profile_id, :binary_id)

      candidate_gender_reciprocal =
        case viewer.gender do
          "man" -> dynamic([_p, dp], dp.show_men == true)
          "woman" -> dynamic([_p, dp], dp.show_women == true)
          "non_binary" -> dynamic([_p, dp], dp.show_non_binary == true)
          _ -> dynamic([_p, _dp], false)
        end

      candidates_query =
        from p in Profile,
          join: dp in DiscoveryPreference,
          on: dp.profile_id == p.id,
          join: pl in ProfileLocation,
          on: pl.profile_id == p.id,
          where: p.id != ^viewer_profile_id,
          where: p.is_discoverable == true,
          where: is_nil(p.deleted_at),
          where: p.is_paused == false,
          where:
            fragment(
              "ST_DWithin(?::geography, ?::geography, ?)",
              pl.coordinates,
              ^point,
              ^distance_meters
            ),
          where:
            fragment(
              "EXTRACT(YEAR FROM AGE(CURRENT_DATE, ?::date)) BETWEEN ? AND ?",
              p.birth_date,
              ^viewer_prefs.age_min,
              ^viewer_prefs.age_max
            ),
          where:
            fragment(
              "EXTRACT(YEAR FROM AGE(CURRENT_DATE, ?::date)) BETWEEN ? AND ?",
              type(^viewer.birth_date, :date),
              dp.age_min,
              dp.age_max
            ),
          where: p.gender in ^interested_in_genders(viewer_prefs),
          where: ^candidate_gender_reciprocal,
          where: p.what_i_am_looking_for == ^viewer.what_i_am_looking_for,
          where: p.id not in subquery(swiped_subquery),
          where: p.id not in subquery(blocked_by_viewer_subquery),
          where: p.id not in subquery(blocked_by_them_subquery),
          where: p.id not in subquery(blocked_tag_profiles),
          select: %{
            id: p.id,
            display_name: p.display_name,
            birth_date: p.birth_date,
            gender: p.gender,
            what_i_am_looking_for: p.what_i_am_looking_for,
            bio: p.bio,
            is_complete: p.is_complete,
            updated_at: p.updated_at,
            shared_tags_count:
              fragment(
                "(SELECT count(*)::int FROM profile_tags pt WHERE pt.profile_id = ? AND pt.tag_id = ANY(?))",
                p.id,
                type(^viewer_tag_ids, {:array, :binary_id})
              ),
            distance_m:
              fragment(
                "ST_Distance(?::geography, ?::geography)",
                pl.coordinates,
                ^point
              ),
            primary_photo_url:
              fragment(
                "(SELECT ph.url FROM profile_photos ph WHERE ph.profile_id = ? AND ph.is_active = true ORDER BY ph.position ASC LIMIT 1)",
                p.id
              ),
            photo_count:
              fragment(
                "(SELECT count(*)::int FROM profile_photos ph WHERE ph.profile_id = ? AND ph.is_active = true)",
                p.id
              )
          }

      # Integer hundredths keep SQL ordering and cursor comparisons identical.
      ranked =
        from c in subquery(candidates_query),
          select_merge: %{
            score_units:
              fragment(
                "(LEAST(? * 10, 50) + 35 + CASE WHEN ? THEN 15 ELSE 0 END + CASE WHEN ? >= ? THEN 10 ELSE 0 END + (get_byte(decode(md5(?::text || ?::text), 'hex'), 0) % 6)) * 100 + ROUND((GREATEST(0.0, 15.0 * (1.0 - ? / ?)))::numeric * 100)::integer",
                c.shared_tags_count,
                c.is_complete,
                c.updated_at,
                type(^active_since, :utc_datetime),
                type(^viewer_profile_id, :string),
                c.id,
                c.distance_m,
                type(^distance_meters, :float)
              )
          }

      page_query =
        from c in subquery(ranked),
          order_by: [desc: c.score_units, asc: c.id],
          limit: ^(limit + 1)

      page_query =
        if cursor do
          from c in page_query,
            where:
              c.score_units < ^cursor.score or
                (c.score_units == ^cursor.score and c.id > ^cursor.id)
        else
          page_query
        end

      rows = Repo.all(page_query)
      page = Enum.take(rows, limit)

      next_cursor =
        if length(rows) > limit,
          do: encode_cursor(List.last(page), viewer_profile_id, as_of),
          else: nil

      profiles =
        Enum.map(page, fn row ->
          row |> Map.put(:score, row.score_units / 100) |> Map.delete(:score_units)
        end)

      {:ok, %{profiles: profiles, next_cursor: next_cursor}}
    end
  end

  defp encode_cursor(row, viewer_id, at) do
    Phoenix.Token.sign(CherryWeb.Endpoint, @cursor_salt, %{
      viewer: viewer_id,
      score: row.score_units,
      id: row.id,
      at: at
    })
  end

  defp decode_cursor(nil, _viewer_id), do: {:ok, nil}

  defp decode_cursor(token, viewer_id) when is_binary(token) and byte_size(token) <= 2048 do
    case Phoenix.Token.verify(CherryWeb.Endpoint, @cursor_salt, token, max_age: 3600) do
      {:ok, %{viewer: ^viewer_id, score: score, id: id, at: %DateTime{}} = cursor}
      when is_integer(score) and is_binary(id) ->
        {:ok, cursor}

      _ ->
        {:error, :invalid_cursor}
    end
  end

  defp decode_cursor(_, _), do: {:error, :invalid_cursor}

  defp interested_in_genders(prefs) do
    [{"man", prefs.show_men}, {"woman", prefs.show_women}, {"non_binary", prefs.show_non_binary}]
    |> Enum.filter(&elem(&1, 1))
    |> Enum.map(&elem(&1, 0))
  end
end
