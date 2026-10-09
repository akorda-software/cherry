defmodule Snack.Dating.Social.PublicProfiles do
  @moduledoc "Public cards: current visibility and live-match access for chat participants."
  import Ecto.Query
  alias Snack.Dating.{Conversation, Match, Profile, ProfileCards, Social}
  alias Snack.Dating.Social.Compatibility
  alias Snack.Repo

  # ── Public profile ─────────────────────────────────────────────────────

  @doc """
  Perfil público de `target_id` visto por el viewer. Devuelve
  `{:ok, %{row: fila, media: media, match: %{id, conversation_id} | nil}}` o
  `{:error, :profile_not_found}` si no es visible (ver el `@moduledoc`).
  """
  def public_profile(%Profile{id: viewer_id} = viewer, target_id) do
    now = now()

    with {:ok, target_id} <- cast_profile_id(target_id),
         %{} = row <- Map.get(ProfileCards.rows(viewer_id, [target_id], now), target_id),
         match = live_match_between(viewer_id, target_id, now),
         true <- public_visible?(row, viewer, match) do
      {:ok, %{row: row, media: ProfileCards.load_media(viewer_id, [target_id]), match: match}}
    else
      _not_visible -> {:error, :profile_not_found}
    end
  end

  defp public_visible?(row, %Profile{id: viewer_id} = viewer, match) do
    profile = row.profile

    cond do
      profile.deleted_at != nil or row.user_deleted_at != nil -> false
      profile.id == viewer_id -> true
      row.blocked -> false
      match != nil -> true
      Social.viewer_status(viewer) != :ok -> false
      not (profile.is_complete and profile.is_discoverable and not profile.is_paused) -> false
      true -> Compatibility.compatible?(viewer, profile.id)
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

  defp cast_profile_id(id) when is_binary(id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} -> {:ok, id}
      :error -> {:error, :profile_not_found}
    end
  end

  defp cast_profile_id(_id), do: {:error, :profile_not_found}

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
