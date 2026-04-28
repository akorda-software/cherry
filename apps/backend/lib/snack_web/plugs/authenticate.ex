defmodule SnackWeb.Plugs.Authenticate do
  @moduledoc """
  Plug that extracts and verifies the Bearer token from the Authorization header,
  then assigns the current user to the connection.
  """

  import Plug.Conn

  alias Snack.Dating
  alias SnackWeb.TokenAuth

  @spec init(any()) :: any()
  def init(opts), do: opts

  @spec call(Plug.Conn.t(), any()) :: Plug.Conn.t()
  def call(conn, _opts) do
    case get_bearer_token(conn) do
      {:ok, token} ->
        case TokenAuth.authenticate(token) do
          {:ok, %{user: user}} ->
            profile = Dating.get_profile_by_user(user.id)

            conn
            |> assign(:current_user, user)
            |> assign(:current_profile, profile)

          _error ->
            halt_unauthorized(conn)
        end

      _error ->
        halt_unauthorized(conn)
    end
  end

  defp get_bearer_token(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      [header | _] when is_binary(header) ->
        case String.split(header, " ", parts: 2) do
          ["Bearer", token] -> {:ok, token}
          _ -> {:error, :invalid_format}
        end

      _ ->
        {:error, :missing_header}
    end
  end

  defp halt_unauthorized(conn) do
    conn
    |> put_status(401)
    |> Phoenix.Controller.json(%{error: "unauthorized"})
    |> halt()
  end
end
