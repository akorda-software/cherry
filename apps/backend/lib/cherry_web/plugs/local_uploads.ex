defmodule CherryWeb.Plugs.LocalUploads do
  @moduledoc "The old local photo route must not survive a switch to private R2."
  def init(opts), do: Plug.Static.init(opts)

  def call(conn, opts) do
    if Cherry.Storage.adapter() == Cherry.Storage.Local do
      Plug.Static.call(conn, opts)
    else
      conn
    end
  end
end
