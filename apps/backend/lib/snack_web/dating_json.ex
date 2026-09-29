defmodule SnackWeb.DatingJSON do
  @moduledoc """
  Serializadores compartidos del dominio dating (etiquetas y fotos) para que
  todos los controllers emitan exactamente la misma forma de payload.
  """

  alias Snack.Dating.{ProfilePhoto, Tag}
  alias SnackWeb.MediaUrl

  @doc "Etiqueta del catálogo. `opts[:shared]` añade el flag `shared` (etiquetas de otro perfil)."
  def tag(%Tag{} = tag, opts \\ []) do
    base = %{
      id: tag.id,
      slug: tag.slug,
      label: tag.label,
      category: tag.category,
      sortOrder: tag.sort_order,
      emoji: Map.get(tag, :emoji)
    }

    case Keyword.fetch(opts, :shared) do
      {:ok, shared} -> Map.put(base, :shared, shared)
      :error -> base
    end
  end

  @doc "Resumen de foto con URL absoluta (cards, perfil público, matches)."
  def photo_summary(conn, %ProfilePhoto{} = photo) do
    %{id: photo.id, url: MediaUrl.absolute(conn, photo.url), position: photo.position}
  end

  @doc "Foto propia completa (`/api/me/*`)."
  def own_photo(conn, %ProfilePhoto{} = photo) do
    %{
      id: photo.id,
      storageKey: photo.storage_key,
      url: MediaUrl.absolute(conn, photo.url),
      position: photo.position,
      isActive: photo.is_active
    }
  end
end
