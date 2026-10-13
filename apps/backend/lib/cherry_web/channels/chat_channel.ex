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

    # The send transaction rechecks authorization after taking the match lock.
    case Dating.send_message(%{
           conversation_id: conversation_id,
           sender_profile_id: profile_id,
           body: body
         }) do
      {:ok, message} ->
        # Replying implies having read everything up to this message.
        # `Dating.send_message/1` already broadcast `new_message`.
        Dating.Inbox.mark_read(conversation_id, profile_id, message.inserted_at)
        {:reply, {:ok, %{message: CherryWeb.ChatJSON.message(message)}}, socket}

      {:error, reason} ->
        {:reply, {:error, format_send_error(reason)}, socket}
    end
  end

  def handle_in("send_message", _payload, socket) do
    {:reply, {:error, %{errors: %{body: ["can't be blank"]}}}, socket}
  end

  @impl true
  def handle_in("typing", _payload, socket) do
    at = System.monotonic_time(:millisecond)
    last_typing_at = socket.assigns[:last_typing_at]

    if is_nil(last_typing_at) or at - last_typing_at >= 1000 do
      socket = assign(socket, :last_typing_at, at)

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
    else
      {:noreply, socket}
    end
  end

  defp join_status(_conversation_id, nil), do: {:error, :profile_required}

  defp join_status(conversation_id, profile_id),
    do: Dating.conversation_messaging_status(conversation_id, profile_id)

  defp format_send_error(reason) when is_atom(reason), do: %{reason: Atom.to_string(reason)}
  defp format_send_error(changeset), do: %{errors: format_errors(changeset)}

  defp format_errors(changeset), do: CherryWeb.ChangesetJSON.errors(changeset)
end
