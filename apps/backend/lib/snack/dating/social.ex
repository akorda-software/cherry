defmodule Snack.Dating.Social do
  @moduledoc """
  Capa social sobre discovery (D-2026-09-29): swipes con errores semánticos,
  deshacer el último "no", perfil público, likes recibidos (visibles y gratis) y
  el resumen de actividad para los badges.

  ## Viewer activo

  Hacer swipe, deshacer y ver perfiles ajenos exige que el viewer tenga el perfil
  completo, descubrible, sin pausar y sin borrar (`viewer_status/1`). La única
  excepción es el perfil público de alguien con quien hay match vivo (para el
  chat) y el propio perfil (vista previa).

  ## Visibilidad de otro perfil

  Perfil público y destino de un swipe. Siempre: existe, ni su perfil ni su
  cuenta están borrados y no hay bloqueo en ninguna dirección. Además:

    * con match vivo entre ambos → visible (aunque los filtros duros ya no
      casen, para poder seguir en el chat);
    * si no, tiene que ser descubrible (completo, descubrible, no pausado) y
      pasar los mismos filtros duros que el feed y la bandeja de likes:
      etiquetas bloqueadas en ambas direcciones, género y edad preferidos del
      viewer, matriz de intención simétrica y `compatible_only` del viewer; y
      los de la otra persona hacia el viewer (género, edad, `compatible_only`)
      salvo que tenga un like *pendiente* al viewer (su like es su
      consentimiento, igual que en la bandeja de likes).

  Un like histórico ya no da visibilidad: tras un unmatch o una caducidad, la
  ex pareja solo se ve si es descubrible y pasa los filtros. Cualquier fallo
  responde igual (`:profile_not_found`), sin revelar la razón.
  """

  alias Snack.Dating.{Inbox, Profile}
  alias Snack.Dating.Social.{PublicProfiles, ReceivedLikes, Swipes}

  defdelegate swipe(viewer, target_id, action_type), to: Swipes
  defdelegate undo_last_dislike(viewer), to: Swipes
  defdelegate public_profile(viewer, target_id), to: PublicProfiles
  defdelegate received_likes(viewer, opts \\ []), to: ReceivedLikes
  defdelegate received_likes_count(viewer), to: ReceivedLikes
  defdelegate likes_default_limit(), to: ReceivedLikes
  defdelegate likes_max_limit(), to: ReceivedLikes

  @doc """
  ¿Puede el viewer hacer swipe, deshacer y ver perfiles ajenos? `:ok`,
  `{:error, :profile_paused}` o `{:error, :profile_incomplete}` (incompleto, no
  descubrible o borrado). Mismas reglas que `GET /api/discovery/feed`.
  """
  def viewer_status(%Profile{is_paused: true}), do: {:error, :profile_paused}

  def viewer_status(%Profile{is_complete: true, is_discoverable: true, deleted_at: nil}),
    do: :ok

  def viewer_status(%Profile{}), do: {:error, :profile_incomplete}

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
end
