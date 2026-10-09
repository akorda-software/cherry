defmodule Snack.Dating.Social.ReceivedLikes do
  @moduledoc "Pending received likes, with viewer filters and scoped signed cursors."
  import Ecto.Query
  alias Snack.Accounts.User
  alias Snack.Dating.{Profile, SwipeAction, UserBlock}
  alias Snack.Dating.Social.Compatibility
  alias Snack.Repo

  @likes_cursor_salt "received-likes-v1"
  @likes_cursor_max_age 24 * 60 * 60
  @likes_default_limit 30
  @likes_max_limit 50

  def likes_default_limit, do: @likes_default_limit
  def likes_max_limit, do: @likes_max_limit

  # ── Received likes ─────────────────────────────────────────────────────

  @doc """
  Likes recibidos a los que el viewer aún no ha respondido, más reciente primero.
  Solo de perfiles completos, descubribles y sin pausar; excluye bloqueos
  (ambas direcciones), cuentas/perfiles borrados y aplica los filtros duros del
  lado del viewer (`apply_viewer_side_filters/3`): etiquetas bloqueadas en
  ambas direcciones, género y edad preferidos (misma fecha UTC que el feed),
  intención y `compatible_only` del viewer.

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

    from(s in SwipeAction,
      as: :swipe,
      join: p in Profile,
      as: :other,
      on: p.id == s.actor_profile_id,
      join: u in User,
      on: u.id == p.user_id,
      where: s.target_profile_id == ^viewer_id and s.action_type == "like",
      where: is_nil(p.deleted_at) and is_nil(u.deleted_at),
      where: p.is_complete and p.is_discoverable and not p.is_paused,
      where: not exists(subquery(responded)),
      where: not exists(subquery(blocked))
    )
    |> Compatibility.apply_viewer_side_filters(viewer, Date.utc_today())
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
end
