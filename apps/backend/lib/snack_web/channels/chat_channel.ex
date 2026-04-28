defmodule SnackWeb.ChatChannel do
  use SnackWeb, :channel

  alias Snack.Dating
  alias Snack.Repo

  @impl true
  def join("chat:" <> conversation_id, _payload, socket) do
    profile_id = socket.assigns.profile_id

    if profile_id && participant?(conversation_id, profile_id) do
      {:ok, assign(socket, :conversation_id, conversation_id)}
    else
      {:error, %{reason: "not_participant"}}
    end
  end

  @impl true
  def handle_in("send_message", %{"body" => body}, socket) do
    conversation_id = socket.assigns.conversation_id
    profile_id = socket.assigns.profile_id

    if participant?(conversation_id, profile_id) do
      case Dating.send_message(%{
             conversation_id: conversation_id,
             sender_profile_id: profile_id,
             body: body
           }) do
        {:ok, message} ->
          broadcast!(socket, "new_message", serialize_message(message))
          {:reply, {:ok, %{message: serialize_message(message)}}, socket}

        {:error, changeset} ->
          {:reply, {:error, %{errors: format_errors(changeset)}}, socket}
      end
    else
      {:reply, {:error, %{reason: "not_participant"}}, socket}
    end
  end

  @impl true
  def handle_in("typing", _payload, socket) do
    broadcast_from!(socket, "typing", %{
      profile_id: socket.assigns.profile_id
    })

    {:noreply, socket}
  end

  defp participant?(conversation_id, profile_id) do
    conversation =
      Dating.get_conversation(conversation_id)
      |> Repo.preload(:match)

    if conversation && conversation.match do
      match = conversation.match
      match.profile_a_id == profile_id || match.profile_b_id == profile_id
    else
      false
    end
  end

  defp serialize_message(%Dating.Message{} = msg) do
    %{
      id: msg.id,
      sender_profile_id: msg.sender_profile_id,
      body: msg.body,
      inserted_at: msg.inserted_at
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
