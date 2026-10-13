defmodule CherryWeb.Plugs.ForceSSL do
  @moduledoc """
  Redirects to HTTPS and sends HSTS (`Plug.SSL`), decided at runtime.

  Phoenix's `force_ssl` is compile-time configuration, so a release built for
  production could not be tried over plain HTTP on a LAN. This plug reads
  `config :cherry, :force_ssl` (set from `FORCE_SSL` in `runtime.exs`) on every
  request: a keyword list of `Plug.SSL` options, or `false` to disable it.
  """

  @behaviour Plug

  @impl true
  def init(opts), do: opts

  @impl true
  def call(conn, _opts) do
    case Application.get_env(:cherry, :force_ssl, false) do
      false -> conn
      ssl_opts -> Plug.SSL.call(conn, Plug.SSL.init(ssl_opts))
    end
  end
end
