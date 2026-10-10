defmodule CherryWeb.Controllers.Api.ChatController do
  use CherryWeb, :controller

  alias Cherry.Dating
  alias Cherry.Dating.Inbox
  alias CherryWeb.ChatJSON

  @doc "Conversaciones visibles, coherentes con `GET /api/matches`."
  def index(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      with {:ok, limit} <- CherryWeb.Pagination.limit(params, 50),
           {:ok, page} <- Inbox.list_page(profile.id, limit: limit, cursor: params["cursor"]) do
        json(conn, %{
          conversations: Enum.map(page.entries, &ChatJSON.conversation_summary(conn, &1)),
          nextCursor: page.next_cursor
        })
      else
        {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
      end
    else
      profile_not_found(conn)
    end
  end

  @doc """
  Historial (más nuevos primero) con `nextCursor` opaco. Solo participantes de
  una conversación activa (sin caducar, sin bloqueos, cuentas vivas).
  """
  def messages(conn, %{"id" => conversation_id} = params) do
    profile = conn.assigns.current_profile

    if profile do
      with {:ok, conversation} <-
             Dating.get_messageable_conversation(conversation_id, profile.id),
           {:ok, limit} <- CherryWeb.Pagination.limit(params, 50),
           {:ok, %{messages: messages, next_cursor: next_cursor}} <-
             Inbox.list_messages_page(conversation.id,
               limit: limit,
               cursor: Map.get(params, "cursor")
             ) do
        json(conn, %{messages: Enum.map(messages, &ChatJSON.message/1), nextCursor: next_cursor})
      else
        {:error, reason} when reason in [:not_participant, :conversation_not_active] ->
          conn |> put_status(:forbidden) |> json(%{error: reason})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
      end
    else
      profile_not_found(conn)
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
          # Replying implies having read everything up to this message (the
          # `new_message` broadcast happens in `Dating.send_message/1`).
          Inbox.mark_read(message.conversation_id, profile.id, message.inserted_at)
          json(conn, %{message: ChatJSON.message(message)})

        {:error, reason} when reason in [:not_participant, :conversation_not_active] ->
          conn |> put_status(:forbidden) |> json(%{error: reason})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      profile_not_found(conn)
    end
  end

  def create_message(conn, _params) do
    if conn.assigns.current_profile do
      conn |> put_status(:unprocessable_entity) |> json(%{errors: %{body: ["can't be blank"]}})
    else
      profile_not_found(conn)
    end
  end

  @doc "Marca la conversación como leída hasta ahora (badges y `unreadCount`)."
  def read(conn, %{"id" => conversation_id}) do
    profile = conn.assigns.current_profile

    if profile do
      case Inbox.mark_read(conversation_id, profile.id) do
        {:ok, _read} ->
          json(conn, %{ok: true})

        {:error, :not_participant} ->
          conn |> put_status(:forbidden) |> json(%{error: "not_participant"})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      profile_not_found(conn)
    end
  end

  defp profile_not_found(conn) do
    conn |> put_status(:not_found) |> json(%{error: "profile_not_found"})
  end

  defp format_errors(changeset), do: CherryWeb.ChangesetJSON.errors(changeset)
end
