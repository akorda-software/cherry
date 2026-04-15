defmodule SnackWeb.PageController do
  use SnackWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
