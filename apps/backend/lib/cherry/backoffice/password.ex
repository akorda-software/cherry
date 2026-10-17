defmodule Cherry.Backoffice.Password do
  @moduledoc "Salted PBKDF2-HMAC-SHA256 passwords using OTP crypto, never reversible encryption."
  @rounds 600_000

  def valid?(password),
    do: is_binary(password) and byte_size(password) <= 256 and String.length(password) >= 16

  def hash(password) do
    salt = :crypto.strong_rand_bytes(16)
    digest = :crypto.pbkdf2_hmac(:sha256, password, salt, @rounds, 32)
    "pbkdf2-sha256$#{@rounds}$#{Base.encode64(salt)}$#{Base.encode64(digest)}"
  end

  def verify(password, stored)
      when is_binary(password) and byte_size(password) <= 256 and is_binary(stored) do
    with ["pbkdf2-sha256", "600000", salt, digest] <- String.split(stored, "$"),
         {:ok, salt} <- Base.decode64(salt),
         {:ok, digest} <- Base.decode64(digest),
         true <- byte_size(salt) == 16 and byte_size(digest) == 32 do
      Plug.Crypto.secure_compare(
        :crypto.pbkdf2_hmac(:sha256, password, salt, @rounds, 32),
        digest
      )
    else
      _ -> dummy_verify(password)
    end
  end

  def verify(password, _), do: dummy_verify(password)

  defp dummy_verify(password) do
    password =
      if is_binary(password) and byte_size(password) <= 256, do: password, else: "invalid"

    :crypto.pbkdf2_hmac(:sha256, password, <<0::128>>, @rounds, 32)
    false
  end
end
