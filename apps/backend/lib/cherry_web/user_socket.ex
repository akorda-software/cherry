defmodule CherryWeb.UserSocket do
  use Phoenix.Socket

  alias Cherry.Dating
  alias CherryWeb.TokenAuth

  channel("chat:*", CherryWeb.ChatChannel)

  @impl true
  def connect(params, socket, _connect_info) do
    token = params["token"] || params["guardian_token"]

    case TokenAuth.authenticate(token) do
      {:ok, %{user: user}} ->
        profile = Dating.get_profile_by_user(user.id)

        socket =
          socket
          |> assign(:user_id, user.id)
          |> assign(:profile_id, profile && profile.id)

        {:ok, socket}

      {:error, _reason} ->
        :error
    end
  end

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end
