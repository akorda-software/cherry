defmodule SnackWeb.Controllers.Api.TagController do
  use SnackWeb, :controller

  alias Snack.Dating
  alias SnackWeb.DatingJSON

  def index(conn, _params) do
    tags = Dating.list_active_tags()

    json(conn, %{tags: Enum.map(tags, &DatingJSON.tag/1)})
  end
end
