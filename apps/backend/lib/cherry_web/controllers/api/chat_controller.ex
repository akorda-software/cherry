defmodule CherryWeb.Controllers.Api.ChatController do
  use CherryWeb, :controller

  alias Cherry.Dating

  def index(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      conversations = Dating.list_conversations(profile.id)

      json(conn, %{
        conversations: Enum.map(conversations, &serialize_conversation(&1, profile.id))
      })
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def messages(conn, %{"id" => conversation_id} = params) do
    profile = conn.assigns.current_profile

    if profile do
      conversation = Dating.get_conversation(conversation_id)

      if conversation && participant?(conversation, profile.id) do
        with {:ok, limit} <- CherryWeb.Pagination.limit(params, 50),
             {:ok, cursor} <- parse_cursor(Map.get(params, "cursor")) do
          msgs = Dating.list_messages(conversation_id, limit: limit, cursor: cursor)
          json(conn, %{messages: Enum.map(msgs, &serialize_message/1)})
        else
          {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
        end
      else
        conn
        |> put_status(:forbidden)
        |> json(%{error: "not_participant"})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def create_message(conn, %{"id" => conversation_id, "body" => body}) do
    profile = conn.assigns.current_profile

    if profile do
      attrs = %{
        conversation_id: conversation_id,
        sender_profile_id: profile.id,
        body: body
      }

      case Dating.send_message(attrs) do
        {:ok, message} ->
          json(conn, %{message: serialize_message(message)})

        {:error, :not_participant} ->
          conn
          |> put_status(:forbidden)
          |> json(%{error: "not_participant"})

        {:error, :conversation_not_active} ->
          conn
          |> put_status(:forbidden)
          |> json(%{error: "conversation_not_active"})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  defp participant?(conversation, profile_id) do
    match = conversation.match
    match.profile_a_id == profile_id || match.profile_b_id == profile_id
  end

  defp serialize_conversation(conversation, viewer_profile_id) do
    match = conversation.match
    other_id = Dating.Match.other_profile(match, viewer_profile_id)
    other = Dating.get_profile(other_id)

    %{
      id: conversation.id,
      matchId: match.id,
      otherProfile: %{
        id: other_id,
        displayName: other && other.display_name,
        age: other && Cherry.Dating.Profile.age(other)
      },
      insertedAt: conversation.inserted_at
    }
  end

  defp serialize_message(%Cherry.Dating.Message{} = msg) do
    %{
      id: msg.id,
      conversationId: msg.conversation_id,
      senderProfileId: msg.sender_profile_id,
      body: msg.body,
      insertedAt: msg.inserted_at
    }
  end

  defp parse_cursor(nil), do: {:ok, nil}

  defp parse_cursor(str) when is_binary(str) do
    case DateTime.from_iso8601(str) do
      {:ok, dt, _} -> {:ok, dt}
      _ -> {:error, :invalid_cursor}
    end
  end

  defp parse_cursor(_), do: {:error, :invalid_cursor}

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
