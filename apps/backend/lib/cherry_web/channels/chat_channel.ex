defmodule CherryWeb.ChatChannel do
  use CherryWeb, :channel

  alias Cherry.Dating

  intercept(["new_message", "typing"])

  @impl true
  def handle_out(event, payload, socket) when event in ["new_message", "typing"] do
    if Dating.conversation_allows_messaging?(
         socket.assigns.conversation_id,
         socket.assigns.profile_id
       ) do
      push(socket, event, payload)
    end

    {:noreply, socket}
  end

  @impl true
  def join("chat:" <> conversation_id, _payload, socket) do
    profile_id = socket.assigns.profile_id

    case join_status(conversation_id, profile_id) do
      {:ok, _conversation} ->
        {:ok, assign(socket, :conversation_id, conversation_id)}

      {:error, reason} ->
        {:error, %{reason: Atom.to_string(reason)}}
    end
  end

  @impl true
  def handle_in("send_message", %{"body" => body}, socket) do
    conversation_id = socket.assigns.conversation_id
    profile_id = socket.assigns.profile_id

    if Dating.conversation_allows_messaging?(conversation_id, profile_id) do
      case Dating.send_message(%{
             conversation_id: conversation_id,
             sender_profile_id: profile_id,
             body: body
           }) do
        {:ok, message} ->
          broadcast!(socket, "new_message", serialize_message(message))
          {:reply, {:ok, %{message: serialize_message(message)}}, socket}

        {:error, changeset} ->
          {:reply, {:error, format_send_error(changeset)}, socket}
      end
    else
      {:reply, {:error, %{reason: "conversation_not_active"}}, socket}
    end
  end

  @impl true
  def handle_in("typing", _payload, socket) do
    if Dating.conversation_allows_messaging?(
         socket.assigns.conversation_id,
         socket.assigns.profile_id
       ) do
      broadcast_from!(socket, "typing", %{
        conversationId: socket.assigns.conversation_id,
        profileId: socket.assigns.profile_id
      })
    end

    {:noreply, socket}
  end

  defp join_status(_conversation_id, nil), do: {:error, :profile_required}

  defp join_status(conversation_id, profile_id),
    do: Dating.conversation_messaging_status(conversation_id, profile_id)

  defp serialize_message(%Dating.Message{} = msg) do
    %{
      id: msg.id,
      conversationId: msg.conversation_id,
      senderProfileId: msg.sender_profile_id,
      body: msg.body,
      insertedAt: msg.inserted_at
    }
  end

  defp format_send_error(reason) when is_atom(reason), do: %{reason: Atom.to_string(reason)}
  defp format_send_error(changeset), do: %{errors: format_errors(changeset)}

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
