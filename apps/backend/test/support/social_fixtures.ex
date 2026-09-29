defmodule Snack.TestSupport.SocialFixtures do
  @moduledoc """
  Helpers para tests de la API social (matches, chat, likes, perfil público).
  """

  import Ecto.Query

  alias Snack.Dating
  alias Snack.Dating.Conversation
  alias Snack.Dating.Match
  alias Snack.Dating.Message
  alias Snack.Dating.SwipeAction
  alias Snack.Repo

  def like!(actor, target), do: swipe!(actor, target, "like")
  def dislike!(actor, target), do: swipe!(actor, target, "dislike")

  def swipe!(actor, target, action_type) do
    {:ok, result} =
      Dating.record_swipe(%{
        actor_profile_id: actor.id,
        target_profile_id: target.id,
        action_type: action_type
      })

    result
  end

  @doc "Like mutuo: devuelve `{match, conversation}`."
  def mutual_match!(a, b) do
    like!(a, b)
    %{match: %Match{} = match} = like!(b, a)
    {match, Repo.get_by!(Conversation, match_id: match.id)}
  end

  @doc "Inserta un mensaje con `inserted_at` controlado (cifrado vía el tipo del schema)."
  def insert_message!(conversation, sender, body, %DateTime{} = at) do
    at = %{DateTime.truncate(at, :second) | microsecond: {0, 6}}

    message =
      %Message{}
      |> Ecto.Changeset.change(%{
        conversation_id: conversation.id,
        sender_profile_id: sender.id,
        body: body,
        inserted_at: at,
        updated_at: at
      })
      |> Repo.insert!()

    from(m in Match, where: m.id == ^conversation.match_id and is_nil(m.first_message_at))
    |> Repo.update_all(set: [first_message_at: DateTime.truncate(at, :second), expires_at: nil])

    message
  end

  @doc "Mueve el `inserted_at` de un swipe (p. ej. para probar la ventana de deshacer)."
  def backdate_swipe!(actor, target, %DateTime{} = at) do
    from(s in SwipeAction,
      where: s.actor_profile_id == ^actor.id and s.target_profile_id == ^target.id
    )
    |> Repo.update_all(set: [inserted_at: DateTime.truncate(at, :second)])
  end

  def expire_match!(%Match{} = match) do
    past = DateTime.utc_now() |> DateTime.add(-1, :hour) |> DateTime.truncate(:second)

    from(m in Match, where: m.id == ^match.id)
    |> Repo.update_all(set: [expires_at: past, first_message_at: nil])
  end

  def seconds_ago(seconds) do
    DateTime.utc_now() |> DateTime.add(-seconds, :second) |> DateTime.truncate(:second)
  end
end
