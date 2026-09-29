defmodule Snack.Dating.Social do
  @moduledoc """
  Capa social sobre discovery (D-2026-09-29): swipes con errores semánticos,
  deshacer el último "no", perfil público, likes recibidos (visibles y gratis) y
  el resumen de actividad para los badges.

  Visibilidad de otro perfil (perfil público y destino de un swipe): existe,
  ni su perfil ni su cuenta están borrados, no hay bloqueo en ninguna dirección
  y, además, es descubrible (completo, no pausado), o hay match vivo entre
  ambos, o esa persona dio like al viewer.
  """

  import Ecto.Query

  alias Snack.Accounts.User
  alias Snack.Dating
  alias Snack.Dating.Conversation
  alias Snack.Dating.DiscoveryPreference
  alias Snack.Dating.Inbox
  alias Snack.Dating.Match
  alias Snack.Dating.Profile
  alias Snack.Dating.ProfileCards
  alias Snack.Dating.SwipeAction
  alias Snack.Dating.UserBlock
  alias Snack.Repo

  @action_types ["like", "dislike"]
  @undo_window_seconds 10 * 60
  @likes_cursor_salt "received-likes-v1"
  @likes_cursor_max_age 24 * 60 * 60
  @likes_default_limit 30
  @likes_max_limit 50

  def likes_default_limit, do: @likes_default_limit
  def likes_max_limit, do: @likes_max_limit

  # ── Swipes ─────────────────────────────────────────────────────────────

  @doc """
  Registra un like/dislike del viewer con errores semánticos:
  `:invalid_action_type`, `:cannot_swipe_self`, `:profile_not_found` (destino
  inexistente o no visible) y `:already_swiped`.
  """
  def swipe(%Profile{id: viewer_id}, target_id, action_type) do
    with :ok <- validate_action_type(action_type),
         {:ok, target_id} <- cast_profile_id(target_id),
         :ok <- validate_not_self(viewer_id, target_id),
         {:ok, status} <- swipe_target_status(viewer_id, target_id),
         :ok <- validate_not_swiped(status) do
      %{actor_profile_id: viewer_id, target_profile_id: target_id, action_type: action_type}
      |> Dating.record_swipe()
      |> normalize_swipe_result()
    end
  end

  defp validate_action_type(action_type) when action_type in @action_types, do: :ok
  defp validate_action_type(_action_type), do: {:error, :invalid_action_type}

  defp validate_not_self(id, id), do: {:error, :cannot_swipe_self}
  defp validate_not_self(_viewer_id, _target_id), do: :ok

  defp validate_not_swiped(%{viewer_swiped: true}), do: {:error, :already_swiped}
  defp validate_not_swiped(_status), do: :ok

  defp swipe_target_status(viewer_id, target_id) do
    now = now()

    status =
      Repo.one(
        from(p in Profile,
          join: u in User,
          on: u.id == p.user_id,
          where: p.id == ^target_id and is_nil(p.deleted_at) and is_nil(u.deleted_at),
          where: not exists(subquery(blocked_pair_query(viewer_id, target_id))),
          select: %{
            discoverable: p.is_discoverable and not p.is_paused,
            liked_viewer:
              fragment(
                "EXISTS (SELECT 1 FROM swipe_actions s WHERE s.actor_profile_id = ? AND s.target_profile_id = ? AND s.action_type = 'like')",
                p.id,
                type(^viewer_id, :binary_id)
              ),
            viewer_swiped:
              fragment(
                "EXISTS (SELECT 1 FROM swipe_actions s WHERE s.actor_profile_id = ? AND s.target_profile_id = ?)",
                type(^viewer_id, :binary_id),
                p.id
              ),
            live_match:
              fragment(
                "EXISTS (SELECT 1 FROM matches m WHERE ((m.profile_a_id = ? AND m.profile_b_id = ?) OR (m.profile_a_id = ? AND m.profile_b_id = ?)) AND m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > ?))",
                type(^viewer_id, :binary_id),
                p.id,
                p.id,
                type(^viewer_id, :binary_id),
                type(^now, :utc_datetime)
              )
          }
        )
      )

    if status && (status.discoverable || status.liked_viewer || status.live_match) do
      {:ok, status}
    else
      {:error, :profile_not_found}
    end
  end

  defp normalize_swipe_result({:ok, result}), do: {:ok, result}

  defp normalize_swipe_result({:error, %Ecto.Changeset{errors: errors} = changeset}) do
    if Enum.any?(errors, fn {_field, {_msg, opts}} -> opts[:constraint] == :unique end) do
      {:error, :already_swiped}
    else
      {:error, changeset}
    end
  end

  defp normalize_swipe_result({:error, reason}), do: {:error, reason}

  # ── Undo ───────────────────────────────────────────────────────────────

  @doc """
  Deshace el swipe más reciente del viewer si fue un `dislike` de hace menos de
  10 minutos y el perfil sigue siendo visible. Devuelve `{:ok, target_profile_id}`
  o `{:error, :nothing_to_undo}`.

  `swipe_actions.inserted_at` tiene resolución de segundos: entre swipes del
  mismo segundo se prioriza el `dislike`.
  """
  def undo_last_dislike(%Profile{id: viewer_id}) do
    Repo.transaction(fn ->
      # Serialise concurrent undos of the same viewer.
      Repo.one!(from(p in Profile, where: p.id == ^viewer_id, lock: "FOR UPDATE", select: p.id))

      with %SwipeAction{action_type: "dislike"} = swipe <- last_swipe(viewer_id),
           true <- within_undo_window?(swipe),
           {:ok, _status} <- swipe_target_status(viewer_id, swipe.target_profile_id) do
        Repo.delete!(swipe)
        swipe.target_profile_id
      else
        _nothing -> Repo.rollback(:nothing_to_undo)
      end
    end)
  end

  defp last_swipe(viewer_id) do
    Repo.one(
      from(s in SwipeAction,
        where: s.actor_profile_id == ^viewer_id,
        order_by: [
          desc: s.inserted_at,
          desc: fragment("CASE WHEN ? = 'dislike' THEN 1 ELSE 0 END", s.action_type),
          desc: s.id
        ],
        limit: 1
      )
    )
  end

  defp within_undo_window?(%SwipeAction{inserted_at: inserted_at}) do
    DateTime.diff(DateTime.utc_now(), inserted_at, :second) < @undo_window_seconds
  end

  # ── Public profile ─────────────────────────────────────────────────────

  @doc """
  Perfil público de `target_id` visto por el viewer. Devuelve
  `{:ok, %{row: fila, media: media, match: %{id, conversation_id} | nil}}` o
  `{:error, :profile_not_found}` si no es visible.
  """
  def public_profile(%Profile{id: viewer_id}, target_id) do
    now = now()

    with {:ok, target_id} <- cast_profile_id(target_id),
         %{} = row <- Map.get(ProfileCards.rows(viewer_id, [target_id], now), target_id),
         match = live_match_between(viewer_id, target_id, now),
         true <- public_visible?(row, viewer_id, match) do
      {:ok, %{row: row, media: ProfileCards.load_media(viewer_id, [target_id]), match: match}}
    else
      _not_visible -> {:error, :profile_not_found}
    end
  end

  defp public_visible?(row, viewer_id, match) do
    profile = row.profile

    cond do
      profile.deleted_at != nil or row.user_deleted_at != nil -> false
      profile.id == viewer_id -> true
      row.blocked -> false
      profile.is_discoverable and not profile.is_paused -> true
      match != nil -> true
      true -> row.liked_viewer
    end
  end

  defp live_match_between(viewer_id, target_id, now) do
    Repo.one(
      from(m in Match,
        join: c in Conversation,
        on: c.match_id == m.id,
        where:
          (m.profile_a_id == ^viewer_id and m.profile_b_id == ^target_id) or
            (m.profile_a_id == ^target_id and m.profile_b_id == ^viewer_id),
        where: m.status == "active" and (is_nil(m.expires_at) or m.expires_at > ^now),
        order_by: [desc: m.matched_at],
        limit: 1,
        select: %{id: m.id, conversation_id: c.id}
      )
    )
  end

  # ── Received likes ─────────────────────────────────────────────────────

  @doc """
  Likes recibidos a los que el viewer aún no ha respondido, más reciente primero.
  Excluye bloqueos (ambas direcciones), cuentas/perfiles borrados, perfiles
  pausados, etiquetas bloqueadas (ambas direcciones) y perfiles fuera del género
  y rango de edad preferidos por el viewer.

  Devuelve `{:ok, %{likes: [%{liked_at, profile_id}], next_cursor}}`.
  """
  def received_likes(%Profile{} = viewer, opts \\ []) do
    limit = Keyword.get(opts, :limit, @likes_default_limit)

    with :ok <- validate_likes_limit(limit),
         {:ok, cursor} <- decode_likes_cursor(Keyword.get(opts, :cursor), viewer.id) do
      rows =
        viewer
        |> received_likes_query()
        |> apply_likes_cursor(cursor)
        |> order_by([swipe: s], desc: s.inserted_at, desc: s.id)
        |> limit(^(limit + 1))
        |> select([swipe: s], %{
          swipe_id: s.id,
          liked_at: s.inserted_at,
          profile_id: s.actor_profile_id
        })
        |> Repo.all()

      page = Enum.take(rows, limit)
      next_cursor = if length(rows) > limit, do: encode_likes_cursor(List.last(page), viewer.id)

      {:ok,
       %{
         likes: Enum.map(page, &Map.take(&1, [:liked_at, :profile_id])),
         next_cursor: next_cursor
       }}
    end
  end

  @doc "Número de likes recibidos pendientes (misma regla que `received_likes/2`)."
  def received_likes_count(%Profile{} = viewer) do
    viewer
    |> received_likes_query()
    |> select([swipe: s], count(s.id))
    |> Repo.one()
  end

  defp validate_likes_limit(limit) when is_integer(limit) and limit in 1..@likes_max_limit,
    do: :ok

  defp validate_likes_limit(_limit), do: {:error, :invalid_limit}

  defp received_likes_query(%Profile{id: viewer_id} = viewer) do
    responded =
      from(r in SwipeAction,
        where:
          r.actor_profile_id == ^viewer_id and
            r.target_profile_id == parent_as(:swipe).actor_profile_id,
        select: 1
      )

    blocked =
      from(b in UserBlock,
        where:
          (b.actor_profile_id == ^viewer_id and
             b.target_profile_id == parent_as(:swipe).actor_profile_id) or
            (b.target_profile_id == ^viewer_id and
               b.actor_profile_id == parent_as(:swipe).actor_profile_id),
        select: 1
      )

    query =
      from(s in SwipeAction,
        as: :swipe,
        join: p in Profile,
        as: :liker,
        on: p.id == s.actor_profile_id,
        join: u in User,
        on: u.id == p.user_id,
        where: s.target_profile_id == ^viewer_id and s.action_type == "like",
        where: is_nil(p.deleted_at) and is_nil(u.deleted_at) and p.is_paused == false,
        where: not exists(subquery(responded)),
        where: not exists(subquery(blocked)),
        # Tag blocks apply in both directions, as in discovery.
        where:
          fragment(
            "NOT EXISTS (SELECT 1 FROM profile_tags pt JOIN profile_blocked_tags vb ON vb.tag_id = pt.tag_id WHERE pt.profile_id = ? AND vb.profile_id = ?)",
            p.id,
            type(^viewer_id, :binary_id)
          ),
        where:
          fragment(
            "NOT EXISTS (SELECT 1 FROM profile_blocked_tags lb JOIN profile_tags vt ON vt.tag_id = lb.tag_id WHERE lb.profile_id = ? AND vt.profile_id = ?)",
            p.id,
            type(^viewer_id, :binary_id)
          )
      )

    query
    |> apply_viewer_preferences(preferences_for(viewer))
    |> apply_intent_compatibility(viewer.what_i_am_looking_for)
  end

  defp preferences_for(%Profile{discovery_preference: %DiscoveryPreference{} = pref}), do: pref

  defp preferences_for(%Profile{id: viewer_id}),
    do: Repo.get_by(DiscoveryPreference, profile_id: viewer_id)

  defp apply_viewer_preferences(query, nil), do: query

  defp apply_viewer_preferences(query, %DiscoveryPreference{} = pref) do
    genders =
      [{"man", pref.show_men}, {"woman", pref.show_women}, {"non_binary", pref.show_non_binary}]
      |> Enum.filter(&elem(&1, 1))
      |> Enum.map(&elem(&1, 0))

    from([liker: p] in query,
      where: p.gender in ^genders,
      where:
        fragment(
          "EXTRACT(YEAR FROM AGE(CURRENT_DATE, ?::date)) BETWEEN ? AND ?",
          p.birth_date,
          ^pref.age_min,
          ^pref.age_max
        )
    )
  end

  # Same symmetric intent matrix as the feed ("a ver qué pasa" sees everyone;
  # relationship and casual never cross).
  defp apply_intent_compatibility(query, nil), do: query

  defp apply_intent_compatibility(query, intent) do
    intents = Snack.Dating.Discovery.compatible_intents(intent)
    from([liker: p] in query, where: p.what_i_am_looking_for in ^intents)
  end

  defp apply_likes_cursor(query, nil), do: query

  defp apply_likes_cursor(query, %{at: at, id: id}) do
    from([swipe: s] in query,
      where: s.inserted_at < ^at or (s.inserted_at == ^at and s.id < ^id)
    )
  end

  defp encode_likes_cursor(%{liked_at: at, swipe_id: id}, viewer_id) do
    Phoenix.Token.sign(SnackWeb.Endpoint, @likes_cursor_salt, %{
      v: viewer_id,
      at: DateTime.to_unix(at),
      id: id
    })
  end

  defp decode_likes_cursor(nil, _viewer_id), do: {:ok, nil}
  defp decode_likes_cursor("", _viewer_id), do: {:ok, nil}

  defp decode_likes_cursor(token, viewer_id) when is_binary(token) and byte_size(token) <= 2048 do
    case Phoenix.Token.verify(SnackWeb.Endpoint, @likes_cursor_salt, token,
           max_age: @likes_cursor_max_age
         ) do
      {:ok, %{v: ^viewer_id, at: at, id: id}} when is_integer(at) and is_binary(id) ->
        {:ok, %{at: DateTime.from_unix!(at), id: id}}

      _invalid ->
        {:error, :invalid_cursor}
    end
  end

  defp decode_likes_cursor(_token, _viewer_id), do: {:error, :invalid_cursor}

  # ── Activity summary ───────────────────────────────────────────────────

  @doc "Contadores para los badges de pestañas."
  def activity_summary(%Profile{} = viewer) do
    counts = Inbox.counts(viewer.id)

    %{
      received_likes_count: received_likes_count(viewer),
      new_matches_count: counts.new_matches_count,
      unread_conversations_count: counts.unread_conversations_count
    }
  end

  # ── Helpers ────────────────────────────────────────────────────────────

  defp blocked_pair_query(viewer_id, target_id) do
    from(b in UserBlock,
      where:
        (b.actor_profile_id == ^viewer_id and b.target_profile_id == ^target_id) or
          (b.actor_profile_id == ^target_id and b.target_profile_id == ^viewer_id),
      select: 1
    )
  end

  defp cast_profile_id(id) when is_binary(id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} -> {:ok, id}
      :error -> {:error, :profile_not_found}
    end
  end

  defp cast_profile_id(_id), do: {:error, :profile_not_found}

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
