defmodule Cherry.Notifications do
  @moduledoc """
  Sends product push notifications through Expo using registered session tokens.
  """

  import Ecto.Query

  alias Cherry.Dating.Conversation
  alias Cherry.Dating.Match
  alias Cherry.Dating.Message
  alias Cherry.Dating.Profile
  alias Cherry.Repo
  alias Cherry.Sessions.PushToken
  alias Cherry.Sessions.SessionFamily

  defp expo_client,
    do: Application.get_env(:cherry, :expo_push_client, Cherry.Notifications.ExpoClient.ReqImpl)

  def deliver_new_match(%Match{} = match) do
    match = Repo.preload(match, [:profile_a, :profile_b])

    case {match.profile_a, match.profile_b} do
      {%Profile{} = profile_a, %Profile{} = profile_b} ->
        [
          deliver_to_profile(profile_a, new_match_message(match, profile_b)),
          deliver_to_profile(profile_b, new_match_message(match, profile_a))
        ]
        |> merge_delivery_results()

      _profiles ->
        {:error, :profile_not_found}
    end
  end

  def deliver_new_message(%Message{} = message) do
    message = Repo.preload(message, [:sender_profile, conversation: [match: []]])

    with %Conversation{match: %Match{} = match} = conversation <- message.conversation,
         recipient_id when is_binary(recipient_id) <-
           Match.other_profile(match, message.sender_profile_id),
         %Profile{} = recipient <- Repo.get(Profile, recipient_id),
         %Profile{} = sender <- message.sender_profile do
      deliver_to_profile(recipient, new_message_message(message, conversation, sender))
    else
      _missing -> {:error, :recipient_not_found}
    end
  end

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

        {:ok,
         %{
           sent: Enum.count(tickets, &(ticket_status(&1) == "ok")),
           tickets: tickets,
           invalidated: invalidated
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp new_match_message(%Match{} = match, %Profile{} = other_profile) do
    %{
      "title" => "Nuevo match",
      "body" => "Has hecho match con #{other_profile.display_name}.",
      "sound" => "default",
      "channelId" => "matches",
      "data" => %{
        "type" => "new_match",
        "matchId" => match.id,
        "profileId" => other_profile.id
      }
    }
  end

  defp new_message_message(
         %Message{} = message,
         %Conversation{} = conversation,
         %Profile{} = sender
       ) do
    %{
      "title" => "Nuevo mensaje de #{sender.display_name}",
      "body" => "Tienes un mensaje nuevo.",
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

  defp merge_delivery_results(results) do
    if Enum.all?(results, &match?({:ok, _result}, &1)) do
      deliveries = Enum.map(results, fn {:ok, result} -> result end)

      {:ok,
       %{
         sent: Enum.sum(Enum.map(deliveries, & &1.sent)),
         tickets: Enum.flat_map(deliveries, & &1.tickets),
         invalidated: Enum.sum(Enum.map(deliveries, & &1.invalidated))
       }}
    else
      {:error, %{deliveries: results}}
    end
  end

  defp ticket_status(ticket), do: Map.get(ticket, "status") || Map.get(ticket, :status)

  defp ticket_error(ticket) do
    get_in(ticket, ["details", "error"]) || get_in(ticket, [:details, :error])
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
