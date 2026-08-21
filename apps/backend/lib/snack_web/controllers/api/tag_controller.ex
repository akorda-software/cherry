defmodule SnackWeb.Controllers.Api.TagController do
  use SnackWeb, :controller

  alias Snack.Dating

  def index(conn, _params) do
    tags = Dating.list_active_tags()

    json(conn, %{tags: Enum.map(tags, &serialize_tag/1)})
  end

  defp serialize_tag(%Snack.Dating.Tag{} = tag) do
    %{
      id: tag.id,
      slug: tag.slug,
      label: tag.label,
      category: tag.category,
      sortOrder: tag.sort_order
    }
  end
end
