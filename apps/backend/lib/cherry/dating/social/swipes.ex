defmodule Cherry.Dating.Social.Swipes do
  @moduledoc "Swipe validation and undo, serialized with matching operations."
  import Ecto.Query
  alias Cherry.Accounts.User
  alias Cherry.Dating.{Matching, Profile, Social, SwipeAction, UserBlock}
  alias Cherry.Dating.Social.Compatibility
  alias Cherry.Repo

  @action_types ["like", "dislike"]
  @undo_window_seconds 10 * 60

  # ── Swipes ─────────────────────────────────────────────────────────────

  @doc """
  Registra un like/dislike del viewer con errores semánticos:
  `:invalid_action_type`, `:profile_paused` / `:profile_incomplete` (viewer no
  activo, ver `viewer_status/1`), `:cannot_swipe_self`, `:profile_not_found`
  (destino inexistente o no visible) y `:already_swiped`.
  """
  def swipe(%Profile{id: viewer_id} = viewer, target_id, action_type) do
    with :ok <- validate_action_type(action_type),
         :ok <- Social.viewer_status(viewer),
         {:ok, target_id} <- cast_profile_id(target_id),
         :ok <- validate_not_self(viewer_id, target_id),
         {:ok, status} <- swipe_target_status(viewer, target_id),
         :ok <- validate_not_swiped(status) do
      %{actor_profile_id: viewer_id, target_profile_id: target_id, action_type: action_type}
      |> Matching.record_swipe()
      |> normalize_swipe_result()
    end
  end

  defp validate_action_type(action_type) when action_type in @action_types, do: :ok
  defp validate_action_type(_action_type), do: {:error, :invalid_action_type}

  defp validate_not_self(id, id), do: {:error, :cannot_swipe_self}
  defp validate_not_self(_viewer_id, _target_id), do: :ok

  defp validate_not_swiped(%{viewer_swiped: true}), do: {:error, :already_swiped}
  defp validate_not_swiped(_status), do: :ok

  defp swipe_target_status(%Profile{id: viewer_id} = viewer, target_id) do
    now = now()
    {enforced, ready, fingerprint} = Cherry.Legal.Policy.requirements()

    status =
      Repo.one(
        from(p in Profile,
          join: u in User,
          on: u.id == p.user_id,
          where: p.id == ^target_id and is_nil(p.deleted_at) and is_nil(u.deleted_at),
          where: is_nil(u.suspended_at),
          where: not (^enforced) or (^ready and u.legal_policy_fingerprint == ^fingerprint),
          where: not exists(subquery(blocked_pair_query(viewer_id, target_id))),
          select: %{
            discoverable: p.is_complete and p.is_discoverable and not p.is_paused,
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

    cond do
      is_nil(status) -> {:error, :profile_not_found}
      status.live_match -> {:ok, status}
      status.discoverable and Compatibility.compatible?(viewer, target_id) -> {:ok, status}
      true -> {:error, :profile_not_found}
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

  # The pair became blocked while the swipe waited for the pair lock.
  defp normalize_swipe_result({:error, :blocked}), do: {:error, :profile_not_found}
  defp normalize_swipe_result({:error, reason}), do: {:error, reason}

  # ── Undo ───────────────────────────────────────────────────────────────

  @doc """
  Deshace el swipe más reciente del viewer si fue un `dislike` de hace menos de
  10 minutos. Devuelve `{:ok, target_profile_id}`, `{:error, :nothing_to_undo}`
  o el error de `viewer_status/1`.

  El deshacer no depende de que la otra persona siga siendo visible: borra el
  «no» del viewer igualmente (si vuelve a ser visible, reaparecerá en el feed).
  Quien llama decide si puede devolver la card (`public_profile/2`).

  `swipe_actions.inserted_at` tiene resolución de segundos: entre swipes del
  mismo segundo se prioriza el `dislike`.
  """
  def undo_last_dislike(%Profile{id: viewer_id} = viewer) do
    with :ok <- Social.viewer_status(viewer) do
      Repo.transaction(fn ->
        # Serialise concurrent undos of the same viewer.
        Repo.one!(from(p in Profile, where: p.id == ^viewer_id, lock: "FOR UPDATE", select: p.id))

        with %SwipeAction{action_type: "dislike"} = swipe <- last_swipe(viewer_id),
             true <- within_undo_window?(swipe) do
          Repo.delete!(swipe)
          swipe.target_profile_id
        else
          _nothing -> Repo.rollback(:nothing_to_undo)
        end
      end)
    end
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
