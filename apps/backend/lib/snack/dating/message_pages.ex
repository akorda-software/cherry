defmodule Snack.Dating.MessagePages do
  @moduledoc "Keyset pagination for authorized message history; legacy cursors remain valid."

  import Ecto.Query
  alias Snack.Dating.Message
  alias Snack.Repo

  @cursor_prefix "m2:"
  @legacy_cursor_prefix "m1:"

  @doc """
  Página de mensajes, más nuevos primero. `cursor` es el `next_cursor` opaco de
  una página anterior (o, por compatibilidad, un instante ISO 8601).
  """
  def list_messages_page(conversation_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    with {:ok, cursor} <- decode_cursor(Keyword.get(opts, :cursor)) do
      rows =
        from(m in Message,
          where: m.conversation_id == ^conversation_id,
          order_by: [desc: m.inserted_at, desc: m.id],
          limit: ^(limit + 1)
        )
        |> apply_cursor(cursor)
        |> Repo.all()

      page = Enum.take(rows, limit)
      next_cursor = if length(rows) > limit, do: encode_cursor(List.last(page))

      {:ok, %{messages: page, next_cursor: next_cursor}}
    end
  end

  # ── Message cursor ─────────────────────────────────────────────────────

  defp apply_cursor(query, nil), do: query

  defp apply_cursor(query, {:before, %DateTime{} = at, id}) do
    from(m in query,
      where: m.inserted_at < ^at or (m.inserted_at == ^at and m.id < ^id)
    )
  end

  defp apply_cursor(query, {:before_time, %DateTime{} = at}) do
    from(m in query, where: m.inserted_at < ^at)
  end

  defp encode_cursor(%Message{inserted_at: at, id: id}) do
    Base.url_encode64(
      @cursor_prefix <> Integer.to_string(DateTime.to_unix(at, :microsecond)) <> ":" <> id,
      padding: false
    )
  end

  defp decode_cursor(nil), do: {:ok, nil}
  defp decode_cursor(""), do: {:ok, nil}

  defp decode_cursor(cursor) when is_binary(cursor) and byte_size(cursor) <= 256 do
    with {:ok, decoded} <- Base.url_decode64(cursor, padding: false),
         {:ok, unit, payload} <- cursor_unit(decoded),
         [unix, id] <- String.split(payload, ":", parts: 2),
         {unix, ""} <- Integer.parse(unix),
         {:ok, at} <- DateTime.from_unix(unix, unit),
         {:ok, id} <- Ecto.UUID.cast(id) do
      {:ok, {:before, to_usec(at), id}}
    else
      _opaque_cursor_invalid -> decode_legacy_cursor(cursor)
    end
  end

  defp decode_cursor(_cursor), do: {:error, :invalid_cursor}

  defp decode_legacy_cursor(cursor) do
    case DateTime.from_iso8601(cursor) do
      {:ok, at, _offset} -> {:ok, {:before_time, to_usec(at)}}
      _error -> {:error, :invalid_cursor}
    end
  end

  defp cursor_unit(@cursor_prefix <> payload), do: {:ok, :microsecond, payload}
  defp cursor_unit(@legacy_cursor_prefix <> payload), do: {:ok, :second, payload}
  defp cursor_unit(_decoded), do: :error

  # Los campos :utc_datetime_usec exigen precisión 6 al volcarse a la BD.
  defp to_usec(%DateTime{microsecond: {value, _precision}} = at),
    do: %{at | microsecond: {value, 6}}
end
