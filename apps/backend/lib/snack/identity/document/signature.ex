defmodule Snack.Identity.Document.Signature do
  @moduledoc """
  Signature algorithms used by eMRTD PKIs (ICAO 9303-12): RSA PKCS#1 v1.5,
  RSASSA-PSS and ECDSA (X9.62 DER and BSI TR-03111 "plain" r‖s), with SHA-1/2.

  Verification goes straight to `:crypto`, which accepts EC keys with explicit
  domain parameters (the ICAO recommendation for CSCA and Document Signer
  certificates; `:public_key` in OTP 28 cannot decode those certificates).
  """

  alias Snack.Identity.Document.Der

  @type digest :: :sha | :sha224 | :sha256 | :sha384 | :sha512
  @type curve :: atom() | tuple()
  @type public_key :: {:rsa, n :: binary(), e :: binary()} | {:ec, point :: binary(), curve()}
  @type algorithm ::
          {:rsa_pkcs1, digest()}
          | {:rsa_pss, digest(), mgf1 :: digest(), salt_length :: non_neg_integer()}
          | {:ecdsa, digest()}
          | {:ecdsa_plain, digest()}

  @digests %{
    "1.3.14.3.2.26" => :sha,
    "2.16.840.1.101.3.4.2.4" => :sha224,
    "2.16.840.1.101.3.4.2.1" => :sha256,
    "2.16.840.1.101.3.4.2.2" => :sha384,
    "2.16.840.1.101.3.4.2.3" => :sha512
  }

  @rsa_pkcs1 %{
    "1.2.840.113549.1.1.5" => :sha,
    "1.2.840.113549.1.1.14" => :sha224,
    "1.2.840.113549.1.1.11" => :sha256,
    "1.2.840.113549.1.1.12" => :sha384,
    "1.2.840.113549.1.1.13" => :sha512
  }

  @ecdsa %{
    "1.2.840.10045.4.1" => :sha,
    "1.2.840.10045.4.3.1" => :sha224,
    "1.2.840.10045.4.3.2" => :sha256,
    "1.2.840.10045.4.3.3" => :sha384,
    "1.2.840.10045.4.3.4" => :sha512
  }

  # BSI TR-03111 ecdsa-plain-signatures (0.4.0.127.0.7.1.1.4.1.x): r‖s.
  @ecdsa_plain %{
    "0.4.0.127.0.7.1.1.4.1.1" => :sha,
    "0.4.0.127.0.7.1.1.4.1.2" => :sha224,
    "0.4.0.127.0.7.1.1.4.1.3" => :sha256,
    "0.4.0.127.0.7.1.1.4.1.4" => :sha384,
    "0.4.0.127.0.7.1.1.4.1.5" => :sha512
  }

  @rsa_encryption "1.2.840.113549.1.1.1"
  @rsassa_pss "1.2.840.113549.1.1.10"
  @mgf1 "1.2.840.113549.1.1.8"
  @ec_public_key "1.2.840.10045.2.1"

  @doc "Digest algorithm from an AlgorithmIdentifier element."
  @spec digest(Der.element()) :: {:ok, digest()} | {:error, :unsupported_algorithm}
  def digest(algorithm_identifier) do
    with {:ok, oid, _params} <- algorithm_identifier(algorithm_identifier),
         {:ok, digest} <- Map.fetch(@digests, oid) do
      {:ok, digest}
    else
      _ -> {:error, :unsupported_algorithm}
    end
  end

  @doc """
  Signature algorithm from an AlgorithmIdentifier element. `digest` is the
  digest of the CMS SignerInfo, used when the identifier names only the key
  type (`rsaEncryption`, `id-ecPublicKey`), as some SODs do.
  """
  @spec algorithm(Der.element(), digest() | nil) ::
          {:ok, algorithm()} | {:error, :unsupported_algorithm}
  def algorithm(algorithm_identifier, digest \\ nil) do
    case algorithm_identifier(algorithm_identifier) do
      {:ok, @rsa_encryption, _params} when digest != nil -> {:ok, {:rsa_pkcs1, digest}}
      {:ok, @ec_public_key, _params} when digest != nil -> {:ok, {:ecdsa, digest}}
      {:ok, @rsassa_pss, params} -> pss(params)
      {:ok, oid, _params} -> by_oid(oid)
      {:error, _} -> {:error, :unsupported_algorithm}
    end
  end

  defp by_oid(oid) do
    cond do
      digest = @rsa_pkcs1[oid] -> {:ok, {:rsa_pkcs1, digest}}
      digest = @ecdsa[oid] -> {:ok, {:ecdsa, digest}}
      digest = @ecdsa_plain[oid] -> {:ok, {:ecdsa_plain, digest}}
      true -> {:error, :unsupported_algorithm}
    end
  end

  # RSASSA-PSS-params ::= SEQUENCE { hashAlgorithm [0] DEFAULT sha1,
  #   maskGenAlgorithm [1] DEFAULT mgf1SHA1, saltLength [2] DEFAULT 20,
  #   trailerField [3] DEFAULT 1 }
  defp pss(nil), do: {:ok, {:rsa_pss, :sha, :sha, 20}}

  defp pss({{:universal, true, 16}, _value, _raw} = params) do
    with {:ok, fields} <- Der.children(params) do
      Enum.reduce_while(fields, {:ok, {:rsa_pss, :sha, :sha, 20}}, fn field, {:ok, acc} ->
        case pss_field(field, acc) do
          {:ok, acc} -> {:cont, {:ok, acc}}
          _error -> {:halt, {:error, :unsupported_algorithm}}
        end
      end)
    else
      _ -> {:error, :unsupported_algorithm}
    end
  end

  defp pss(_params), do: {:error, :unsupported_algorithm}

  defp pss_field({{:context, true, 0}, value, _raw}, {:rsa_pss, _hash, mgf, salt}) do
    with {:ok, digest} <- explicit_digest(value), do: {:ok, {:rsa_pss, digest, mgf, salt}}
  end

  defp pss_field({{:context, true, 1}, value, _raw}, {:rsa_pss, hash, _mgf, salt}) do
    with {:ok, element} <- Der.decode(value),
         {:ok, @mgf1, mgf_params} <- algorithm_identifier(element),
         {:ok, digest} <- digest(mgf_params) do
      {:ok, {:rsa_pss, hash, digest, salt}}
    end
  end

  defp pss_field({{:context, true, 2}, value, _raw}, {:rsa_pss, hash, mgf, _salt}) do
    with {:ok, element} <- Der.decode(value),
         {:ok, salt} when salt >= 0 <- Der.integer(element) do
      {:ok, {:rsa_pss, hash, mgf, salt}}
    end
  end

  defp pss_field({{:context, true, 3}, value, _raw}, acc) do
    case Der.decode(value) do
      {:ok, element} -> if Der.integer(element) == {:ok, 1}, do: {:ok, acc}, else: :error
      error -> error
    end
  end

  defp pss_field(_field, _acc), do: :error

  defp explicit_digest(value) do
    with {:ok, element} <- Der.decode(value), do: digest(element)
  end

  @doc "Splits an AlgorithmIdentifier into its OID and optional parameters element."
  @spec algorithm_identifier(Der.element()) ::
          {:ok, String.t(), Der.element() | nil} | {:error, :malformed}
  def algorithm_identifier({{:universal, true, 16}, _value, _raw} = element) do
    case Der.children(element) do
      {:ok, [oid]} ->
        with {:ok, oid} <- Der.oid(oid), do: {:ok, oid, nil}

      # Explicit NULL parameters are the same as none.
      {:ok, [oid, {{:universal, false, 5}, "", _raw}]} ->
        with {:ok, oid} <- Der.oid(oid), do: {:ok, oid, nil}

      {:ok, [oid, params]} ->
        with {:ok, oid} <- Der.oid(oid), do: {:ok, oid, params}

      _other ->
        {:error, :malformed}
    end
  end

  def algorithm_identifier(_element), do: {:error, :malformed}

  @doc "Verifies `signature` over `message`. Never raises."
  @spec verify(algorithm(), binary(), binary(), public_key()) :: boolean()
  def verify({:rsa_pkcs1, digest}, message, signature, {:rsa, n, e}) do
    safe_verify(fn ->
      :crypto.verify(:rsa, digest, message, signature, [e, n], rsa_padding: :rsa_pkcs1_padding)
    end)
  end

  def verify({:rsa_pss, digest, mgf, salt}, message, signature, {:rsa, n, e}) do
    safe_verify(fn ->
      :crypto.verify(:rsa, digest, message, signature, [e, n],
        rsa_padding: :rsa_pkcs1_pss_padding,
        rsa_pss_saltlen: salt,
        rsa_mgf1_md: mgf
      )
    end)
  end

  def verify({:ecdsa, digest}, message, signature, {:ec, point, curve}) do
    safe_verify(fn -> :crypto.verify(:ecdsa, digest, message, signature, [point, curve]) end)
  end

  def verify({:ecdsa_plain, digest}, message, signature, {:ec, _point, _curve} = key)
      when byte_size(signature) > 0 and rem(byte_size(signature), 2) == 0 do
    half = div(byte_size(signature), 2)
    <<r::binary-size(half), s::binary-size(half)>> = signature
    verify({:ecdsa, digest}, message, ecdsa_der(r, s), key)
  end

  def verify(_algorithm, _message, _signature, _key), do: false

  defp safe_verify(fun) do
    fun.() == true
  rescue
    _error -> false
  catch
    _kind, _reason -> false
  end

  # Ecdsa-Sig-Value ::= SEQUENCE { r INTEGER, s INTEGER }
  defp ecdsa_der(r, s) do
    body = der_uint(r) <> der_uint(s)
    <<0x30>> <> der_length(byte_size(body)) <> body
  end

  defp der_uint(bytes) do
    bytes = strip_zeros(bytes)
    bytes = if match?(<<1::1, _::bitstring>>, bytes), do: <<0>> <> bytes, else: bytes
    <<0x02>> <> der_length(byte_size(bytes)) <> bytes
  end

  defp strip_zeros(<<0, rest::binary>>) when rest != "", do: strip_zeros(rest)
  defp strip_zeros(""), do: <<0>>
  defp strip_zeros(bytes), do: bytes

  defp der_length(length) when length < 0x80, do: <<length>>

  defp der_length(length) do
    bytes = :binary.encode_unsigned(length)
    <<0x80 + byte_size(bytes)>> <> bytes
  end

  @doc "Hash with one of the supported digests."
  @spec hash(digest(), iodata()) :: binary()
  def hash(digest, data), do: :crypto.hash(digest, data)
end
