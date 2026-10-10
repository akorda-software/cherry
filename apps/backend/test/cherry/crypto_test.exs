defmodule Cherry.CryptoTest do
  use ExUnit.Case, async: true

  import Bitwise, only: [bxor: 2]

  alias Cherry.Crypto

  @nonce_bytes 12
  @tag_bytes 16

  describe "encrypt/1 y decrypt/1" do
    test "roundtrip devuelve el texto original" do
      {:ok, stored} = Crypto.encrypt("Hola, ¿qué tal?")

      assert String.starts_with?(stored, Crypto.storage_prefix())
      assert {:ok, "Hola, ¿qué tal?"} = Crypto.decrypt(stored)
    end

    test "roundtrip de texto vacío" do
      {:ok, stored} = Crypto.encrypt("")

      assert Crypto.encrypted?(stored)
      assert {:ok, ""} = Crypto.decrypt(stored)
    end

    test "dos cifrados del mismo texto producen valores distintos (nonce aleatorio)" do
      {:ok, first} = Crypto.encrypt("mismo texto")
      {:ok, second} = Crypto.encrypt("mismo texto")

      refute first == second
    end

    test "no persiste el texto en claro" do
      {:ok, stored} = Crypto.encrypt("secreto")

      refute stored =~ "secreto"
    end

    test "un ciphertext manipulado no se descifra" do
      {:ok, stored} = Crypto.encrypt("secreto")
      prefix_len = byte_size(Crypto.storage_prefix())
      <<prefix::binary-size(prefix_len), payload::binary>> = stored

      {:ok, <<nonce::binary-size(@nonce_bytes), rest::binary>>} = Base.decode64(payload)
      ct_size = byte_size(rest) - @tag_bytes
      <<ct::binary-size(ct_size), tag::binary-size(@tag_bytes)>> = rest

      <<first, tail::binary>> = ct
      tampered_ct = <<bxor(first, 1), tail::binary>>

      tampered = prefix <> Base.encode64(<<nonce::binary, tampered_ct::binary, tag::binary>>)

      assert :error == Crypto.decrypt(tampered)
    end

    test "base64 inválido devuelve :error" do
      assert :error == Crypto.decrypt(Crypto.storage_prefix() <> "no-es-base64!!!")
    end

    test "valores legacy sin prefijo se devuelven tal cual" do
      assert {:ok, "texto antiguo en claro"} = Crypto.decrypt("texto antiguo en claro")
    end

    test "nil se conserva" do
      assert {:ok, nil} = Crypto.encrypt(nil)
      assert {:ok, nil} = Crypto.decrypt(nil)
    end
  end

  describe "encrypted?/1" do
    test "reconoce valores cifrados y legacy" do
      {:ok, stored} = Crypto.encrypt("secreto")

      assert Crypto.encrypted?(stored)
      refute Crypto.encrypted?("texto en claro")
    end
  end

  describe "encrypt!/1" do
    test "devuelve el valor cifrado directamente" do
      stored = Crypto.encrypt!("secreto")

      assert Crypto.encrypted?(stored)
      assert {:ok, "secreto"} = Crypto.decrypt(stored)
    end
  end
end
