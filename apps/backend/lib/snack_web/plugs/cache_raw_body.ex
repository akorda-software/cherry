defmodule SnackWeb.Plugs.CacheRawBody do
  @moduledoc """
  Plug that caches the raw request body for signature verification.
  Must be placed before the body parser in the pipeline.
  """

  import Plug.Conn

  @spec init(any()) :: any()
  def init(opts), do: opts

  @spec call(Plug.Conn.t(), any()) :: Plug.Conn.t()
  def call(conn, _opts) do
    case conn.private[:raw_body] do
      nil ->
        {:ok, body, conn} = Plug.Conn.read_body(conn)
        put_private(conn, :raw_body, body)

      _body ->
        conn
    end
  end
end
