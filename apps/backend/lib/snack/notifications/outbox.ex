defmodule Snack.Notifications.Outbox do
  @moduledoc """
  Transactional push outbox. Call from the transaction creating the event.
  Jobs contain only IDs, and each recipient retries independently. Users without
  an active registered device don't need a job.
  """

  import Ecto.Query

  alias Snack.Dating.{Match, Message, Profile}
  alias Snack.Notifications.PushWorker
  alias Snack.Repo
  alias Snack.Sessions.{PushToken, SessionFamily}

  def enqueue_new_match(nil), do: {:ok, []}

  def enqueue_new_match(%Match{} = match) do
    enqueue("new_match", match.id, [match.profile_a_id, match.profile_b_id])
  end

  def enqueue_new_message(%Message{} = message, %Match{} = match) do
    enqueue("new_message", message.id, [Match.other_profile(match, message.sender_profile_id)])
  end

  defp enqueue(event, entity_id, profile_ids) do
    recipients =
      Repo.all(
        from(p in Profile,
          join: token in PushToken,
          on: token.user_id == p.user_id,
          join: family in SessionFamily,
          on: family.id == token.session_family_id,
          where: p.id in ^profile_ids,
          where: token.status == "active" and is_nil(family.revoked_at),
          distinct: true,
          select: p.id
        )
      )

    Enum.reduce_while(recipients, {:ok, []}, fn recipient_id, {:ok, jobs} ->
      args = %{event: event, entity_id: entity_id, recipient_profile_id: recipient_id}

      case args |> PushWorker.new() |> Oban.insert() do
        {:ok, job} -> {:cont, {:ok, [job | jobs]}}
        {:error, changeset} -> {:halt, {:error, changeset}}
      end
    end)
  end
end
