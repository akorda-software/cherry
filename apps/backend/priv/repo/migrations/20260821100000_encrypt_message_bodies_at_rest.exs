defmodule Cherry.Repo.Migrations.EncryptMessageBodiesAtRest do
  use Ecto.Migration

  import Ecto.Query, only: [from: 2]

  alias Cherry.Crypto

  @doc """
  Cifra los cuerpos de mensaje existentes que aún están en claro (D-2026-08-21).
  """
  def up do
    legacy_rows =
      repo().all(
        from(m in "messages",
          where: not like(m.body, ^"#{Crypto.storage_prefix()}%"),
          select: %{id: m.id, body: m.body}
        )
      )

    Enum.each(legacy_rows, fn %{id: id, body: body} ->
      repo().update_all(
        from(m in "messages", where: m.id == type(^to_uuid(id), :binary_id)),
        set: [body: Crypto.encrypt!(body)]
      )
    end)
  end

  def down do
    encrypted_rows =
      repo().all(
        from(m in "messages",
          where: like(m.body, ^"#{Crypto.storage_prefix()}%"),
          select: %{id: m.id, body: m.body}
        )
      )

    Enum.each(encrypted_rows, fn %{id: id, body: body} ->
      {:ok, plaintext} = Crypto.decrypt(body)

      repo().update_all(
        from(m in "messages", where: m.id == type(^to_uuid(id), :binary_id)),
        set: [body: plaintext]
      )
    end)
  end

  # En queries schemaless Postgrex puede devolver el uuid como binario crudo
  # (16 bytes) o como string según el contexto; se normaliza a string porque
  # es lo que espera :binary_id al tipar el parámetro.
  defp to_uuid(<<_::binary-size(16)>> = raw), do: Ecto.UUID.load!(raw)
  defp to_uuid(id) when is_binary(id), do: id
end
