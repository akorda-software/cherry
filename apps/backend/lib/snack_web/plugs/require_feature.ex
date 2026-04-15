defmodule SnackWeb.Plugs.RequireFeature do
  @moduledoc """
  Plug that gates access behind a runtime feature flag.

  When the flag is disabled (or absent), the plug halts the connection with 404.
  When enabled, the request passes through normally.

  ## Usage in a pipeline

      plug RequireFeature, :subscriptions
  """

  import Plug.Conn

  @spec init(atom()) :: atom()
  def init(flag_key) when is_atom(flag_key), do: flag_key

  @spec call(Plug.Conn.t(), atom()) :: Plug.Conn.t()
  def call(conn, flag_key) do
    if Snack.Features.enabled?(flag_key) do
      conn
    else
      conn
      |> put_status(404)
      |> Phoenix.Controller.json(%{error: "not_found"})
      |> halt()
    end
  end
end
