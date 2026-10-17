defmodule CherryWeb.Plugs.RequireGoodStanding do
  @moduledoc "Restrict social activity, never reporting, account deletion, privacy or appeals."
  import Plug.Conn
  def init(opts), do: opts
  def call(%{assigns: %{current_user: %{suspended_at: nil}}} = conn, _), do: conn

  def call(conn, _),
    do:
      conn
      |> put_status(:forbidden)
      |> Phoenix.Controller.json(%{error: "account_suspended"})
      |> halt()
end
