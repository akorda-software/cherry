defmodule CherryWeb.Controllers.Api.TagController do
  use CherryWeb, :controller

  alias Cherry.Dating
  alias CherryWeb.DatingJSON

  def index(conn, _params) do
    tags = Dating.list_active_tags()

    json(conn, %{tags: Enum.map(tags, &DatingJSON.tag/1)})
  end
end
