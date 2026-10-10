defmodule Cherry.Notifications do
  @moduledoc """
  Sends product push notifications through Expo using registered session tokens.
  """

  import Ecto.Query

  alias Cherry.Dating.Conversation
  alias Cherry.Dating.ConversationRead
  alias Cherry.Dating.Match
  alias Cherry.Dating.Message
  alias Cherry.Dating.Profile
  alias Cherry.Repo
  alias Cherry.Sessions.PushToken
  alias Cherry.Sessions.SessionFamily

  defp expo_client,
    do: Application.get_env(:cherry, :expo_push_client, Cherry.Notifications.ExpoClient.ReqImpl)

  @doc "Recheck current permissions before delivering an outbox event."
  def deliver_event(%{
        "event" => "new_match",
        "entity_id" => match_id,
        "recipient_profile_id" => recipient_id
      }) do
    with %Conversation{} = conversation <- Repo.get_by(Conversation, match_id: match_id),
         {:ok, conversation} <-
           Cherry.Dating.Messaging.get_messageable_conversation(conversation.id, recipient_id),
         %Profile{} = recipient <- Repo.get(Profile, recipient_id),
         %Profile{} = other <-
           Repo.get(Profile, Match.other_profile(conversation.match, recipient_id)) do
      match = %{conversation.match | conversation: conversation}
      deliver_to_profile(recipient, new_match_message(match, other)) |> worker_result()
    else
      _obsolete -> {:cancel, :notification_obsolete}
    end
  end

  def deliver_event(%{
        "event" => "new_message",
        "entity_id" => message_id,
        "recipient_profile_id" => recipient_id
      }) do
    with %Message{} = message <- Repo.get(Message, message_id),
         {:ok, conversation} <-
           Cherry.Dating.Messaging.get_messageable_conversation(
             message.conversation_id,
             recipient_id
           ),
         true <-
           Match.other_profile(conversation.match, message.sender_profile_id) == recipient_id,
         false <- already_read?(message, recipient_id),
         %Profile{} = recipient <- Repo.get(Profile, recipient_id),
         %Profile{} = sender <- Repo.get(Profile, message.sender_profile_id) do
      deliver_to_profile(recipient, new_message_message(message, conversation, sender))
      |> worker_result()
    else
      _obsolete -> {:cancel, :notification_obsolete}
    end
  end

  defp already_read?(message, profile_id) do
    Repo.exists?(
      from(r in ConversationRead,
        where: r.conversation_id == ^message.conversation_id and r.profile_id == ^profile_id,
        where: r.last_read_at >= ^message.inserted_at
      )
    )
  end

  defp worker_result({:ok, _delivery}), do: :ok

  defp worker_result({:error, %{status: status}})
       when status in 400..499 and status not in [408, 429],
       do: {:cancel, {:push_rejected, status}}

  defp worker_result({:error, _reason}), do: {:error, :push_delivery_failed}

  def deliver_to_profile(%Profile{user_id: user_id}, message) when is_map(message) do
    user_id
    |> active_push_tokens_for_user()
    |> deliver_to_tokens(message)
  end

  def deliver_to_profile(_profile, _message), do: {:error, :profile_not_found}

  defp active_push_tokens_for_user(user_id) do
    Repo.all(
      from(push_token in PushToken,
        join: session_family in SessionFamily,
        on: session_family.id == push_token.session_family_id,
        where:
          push_token.user_id == ^user_id and push_token.status == "active" and
            is_nil(session_family.revoked_at),
        order_by: [desc: push_token.last_seen_at, desc: push_token.inserted_at]
      )
    )
  end

  defp deliver_to_tokens([], _message), do: {:ok, %{sent: 0, tickets: [], invalidated: 0}}

  defp deliver_to_tokens(push_tokens, message) do
    messages = Enum.map(push_tokens, &Map.put(message, "to", &1.expo_push_token))

    case expo_client().send_messages(messages, []) do
      {:ok, tickets} ->
        invalidated = deactivate_unregistered_tokens(push_tokens, tickets)

        if Enum.any?(tickets, &retryable_ticket?/1) do
          {:error, :push_ticket_rejected}
        else
          {:ok,
           %{
             sent: Enum.count(tickets, &(ticket_status(&1) == "ok")),
             tickets: tickets,
             invalidated: invalidated
           }}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp new_match_message(%Match{} = match, %Profile{} = other_profile) do
    %{
      "title" => new_match_title(other_profile.display_name),
      "body" => "Os habéis gustado. Rompe el hielo cuando te apetezca 👋",
      "sound" => "default",
      "channelId" => "matches",
      "data" =>
        %{
          "type" => "new_match",
          "matchId" => match.id,
          "profileId" => other_profile.id
        }
        |> put_conversation_id(match)
    }
  end

  defp new_match_title(name) when is_binary(name) and name != "", do: "¡Match con #{name}! 💘"
  defp new_match_title(_name), do: "¡Tienes un match nuevo! 💘"

  defp put_conversation_id(data, %Match{conversation: %Conversation{id: id}}),
    do: Map.put(data, "conversationId", id)

  defp put_conversation_id(data, _match), do: data

  defp new_message_message(
         %Message{} = message,
         %Conversation{} = conversation,
         %Profile{} = sender
       ) do
    %{
      "title" => new_message_title(sender.display_name),
      "body" => "Tienes un mensaje nuevo esperándote 💬",
      "sound" => "default",
      "channelId" => "messages",
      "data" => %{
        "type" => "new_message",
        "conversationId" => conversation.id,
        "messageId" => message.id,
        "senderProfileId" => sender.id
      }
    }
  end

  defp new_message_title(name) when is_binary(name) and name != "", do: "#{name} te ha escrito"
  defp new_message_title(_name), do: "Tienes un mensaje nuevo"

  defp deactivate_unregistered_tokens(push_tokens, tickets) do
    push_tokens
    |> Enum.zip(tickets)
    |> Enum.reduce(0, fn {push_token, ticket}, count ->
      if ticket_error(ticket) == "DeviceNotRegistered" do
        deactivate_push_token(push_token)
        count + 1
      else
        count
      end
    end)
  end

  defp deactivate_push_token(%PushToken{} = push_token) do
    push_token
    |> PushToken.changeset(%{status: "inactive", disabled_at: now()})
    |> Repo.update()
  end

  defp ticket_status(ticket), do: Map.get(ticket, "status") || Map.get(ticket, :status)

  defp retryable_ticket?(ticket) do
    ticket_status(ticket) == "error" and
      ticket_error(ticket) not in ["DeviceNotRegistered", "MessageTooBig", "InvalidCredentials"]
  end

  defp ticket_error(ticket) do
    get_in(ticket, ["details", "error"]) || get_in(ticket, [:details, :error])
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
