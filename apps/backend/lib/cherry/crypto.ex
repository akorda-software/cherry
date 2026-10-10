defmodule Cherry.Crypto do
  @moduledoc """
  Cifrado en reposo para contenido de mensajes (decisión D-2026-08-21).

  Cifra con AES-256-GCM usando una clave derivada de `MESSAGE_ENCRYPTION_KEY`
  (config `:cherry, :message_cipher`), que nunca vive en la base de datos: si la
  BD o sus backups se filtran, el contenido de los mensajes no es legible.

  Formato almacenado: `"v1:" <> Base.encode64(nonce <> ciphertext <> tag)`.
  El prefijo versiona el *formato* de serialización (permite migrar a otro
  esquema en el futuro). **No** identifica la clave: rotar
  `MESSAGE_ENCRYPTION_KEY` exige re-cifrar las filas existentes con la clave
  anterior antes de cambiarla; hasta que exista un procedimiento de re-cifrado,
  la clave debe tratarse como permanente. Valores sin prefijo se interpretan
  como legacy en claro y se devuelven tal cual al leer (compatibilidad con
  datos previos a la migración).
  """

  @version "v1"
  @prefix @version <> ":"
  @nonce_bytes 12
  @tag_bytes 16

  @doc """
  Prefijo de versión usado en el formato almacenado (`"v1:"`).
  """
  def storage_prefix, do: @prefix

  @doc """
  Cifra `plaintext` y devuelve el valor listo para persistir.
  """
  def encrypt(nil), do: {:ok, nil}

  def encrypt(plaintext) when is_binary(plaintext) do
    nonce = :crypto.strong_rand_bytes(@nonce_bytes)

    {ciphertext, tag} =
      :crypto.crypto_one_time_aead(
        :aes_256_gcm,
        key!(),
        nonce,
        plaintext,
        "",
        @tag_bytes,
        true
      )

    {:ok,
     @prefix <>
       Base.encode64(
         <<nonce::binary-size(@nonce_bytes), ciphertext::binary, tag::binary-size(@tag_bytes)>>
       )}
  end

  def encrypt!(plaintext) do
    {:ok, encrypted} = encrypt(plaintext)
    encrypted
  end

  @doc """
  Descifra un valor persistido.

  Los valores sin el prefijo de versión se consideran legacy en claro y se
  devuelven sin cambios.
  """
  def decrypt(nil), do: {:ok, nil}

  def decrypt(stored) when is_binary(stored) do
    case stored do
      @prefix <> payload -> decrypt_v1(payload)
      _legacy -> {:ok, stored}
    end
  end

  @doc """
  Indica si un valor ya está cifrado con el formato actual.
  """
  def encrypted?(stored) when is_binary(stored), do: String.starts_with?(stored, @prefix)

  defp decrypt_v1(payload) do
    case Base.decode64(payload) do
      {:ok, <<nonce::binary-size(@nonce_bytes), rest::binary>>}
      when byte_size(rest) >= @tag_bytes ->
        ciphertext_size = byte_size(rest) - @tag_bytes
        <<ciphertext::binary-size(ciphertext_size), tag::binary-size(@tag_bytes)>> = rest

        decrypt_gcm(nonce, ciphertext, tag)

      _ ->
        :error
    end
  end

  defp decrypt_gcm(nonce, ciphertext, tag) do
    case :crypto.crypto_one_time_aead(:aes_256_gcm, key!(), nonce, ciphertext, "", tag, false) do
      plaintext when is_binary(plaintext) -> {:ok, plaintext}
      :error -> :error
    end
  rescue
    _ -> :error
  end

  defp key! do
    case Application.get_env(:cherry, :message_cipher, [])[:key] do
      key when is_binary(key) and byte_size(key) > 0 ->
        :crypto.hash(:sha256, key)

      _ ->
        raise ArgumentError,
              "Cherry.Crypto: falta la config :cherry, :message_cipher " <>
                "(variable de entorno MESSAGE_ENCRYPTION_KEY)"
    end
  end
end
