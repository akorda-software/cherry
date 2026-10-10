defmodule Cherry.Identity.Document.Sod do
  @moduledoc """
  EF.SOD of an eMRTD (ICAO 9303-10 §4.6.2): a CMS SignedData whose content is
  the LDSSecurityObject with the hash of every data group on the chip.

      EF.SOD ::= [APPLICATION 23] ContentInfo
      ContentInfo ::= SEQUENCE { contentType (signedData), content [0] EXPLICIT SignedData }
      LDSSecurityObject ::= SEQUENCE { version, hashAlgorithm,
        dataGroupHashValues SEQUENCE OF SEQUENCE { dataGroupNumber, dataGroupHashValue },
        ldsVersionInfo OPTIONAL }

  Only parsing: checking signatures and certificates is `PassiveAuth`'s job.
  """

  alias Cherry.Identity.Document.{Der, Signature}

  # ICAO recommends one SignerInfo and one certificate; more is only accepted
  # up to a small bound (each costs signature verifications).
  @max_signers 2
  @max_certificates 4

  @signed_data "1.2.840.113549.1.7.2"
  @lds_security_object "2.23.136.1.1.1"
  @content_type_attr "1.2.840.113549.1.9.3"
  @message_digest_attr "1.2.840.113549.1.9.4"

  defstruct [:content_type, :content, :hash_algorithm, :hashes, certificates: [], signers: []]

  @type signer :: %{
          sid: {:issuer_serial, binary(), integer()} | {:ski, binary()},
          digest: Signature.digest(),
          signature_algorithm: Der.element(),
          signed_attrs: binary() | nil,
          content_type: String.t() | nil,
          message_digest: binary() | nil,
          signature: binary()
        }

  @type t :: %__MODULE__{
          content_type: String.t(),
          content: binary(),
          hash_algorithm: Signature.digest(),
          hashes: %{pos_integer() => binary()},
          certificates: [binary()],
          signers: [signer()]
        }

  @doc "Parses EF.SOD (with or without the 0x77 wrapper)."
  @spec parse(binary()) :: {:ok, t()} | {:error, :malformed_sod | :unsupported_algorithm}
  def parse(bin) when is_binary(bin) do
    with {:ok, content_info} <- unwrap(bin),
         {:ok, [type, {{:context, true, 0}, explicit, _}]} <- Der.children(content_info),
         {:ok, @signed_data} <- Der.oid(type),
         {:ok, signed_data} <- Der.decode(explicit),
         {:ok, sod} <- signed_data(signed_data),
         {:ok, lds} <- lds_security_object(sod.content) do
      {:ok, Map.merge(sod, lds)}
    else
      {:error, :unsupported_algorithm} = error -> error
      _ -> {:error, :malformed_sod}
    end
  end

  def parse(_bin), do: {:error, :malformed_sod}

  defp unwrap(bin) do
    case Der.decode(bin) do
      {:ok, {{:application, true, 23}, value, _}} -> Der.decode(value)
      {:ok, {{:universal, true, 16}, _, _} = content_info} -> {:ok, content_info}
      _ -> :error
    end
  end

  # SignedData ::= SEQUENCE { version, digestAlgorithms SET, encapContentInfo,
  #   certificates [0] IMPLICIT OPTIONAL, crls [1] IMPLICIT OPTIONAL, signerInfos SET }
  defp signed_data(element) do
    with {:ok, [_version, _digests, encap | rest]} <- Der.children(element),
         {:ok, content_type, content} <- encapsulated(encap),
         {:ok, certificates, signer_infos} <- certificates_and_signers(rest),
         {:ok, signers} <- signers(signer_infos) do
      {:ok,
       %__MODULE__{
         content_type: content_type,
         content: content,
         certificates: certificates,
         signers: signers
       }}
    end
  end

  # EncapsulatedContentInfo ::= SEQUENCE { eContentType, eContent [0] EXPLICIT OCTET STRING }
  defp encapsulated(encap) do
    with {:ok, [type, {{:context, true, 0}, explicit, _}]} <- Der.children(encap),
         {:ok, type} <- Der.oid(type),
         {:ok, octets} <- Der.decode(explicit),
         {:ok, content} <- Der.octet_string(octets) do
      {:ok, type, content}
    end
  end

  defp certificates_and_signers(fields) do
    {certs, fields} =
      case fields do
        [{{:context, true, 0}, value, _} | rest] -> {value, rest}
        rest -> {nil, rest}
      end

    fields = Enum.reject(fields, &match?({{:context, true, 1}, _, _}, &1))

    with [{{:universal, true, 17}, _, _} = signer_infos] <- fields,
         {:ok, certificates} when length(certificates) <= @max_certificates <-
           certificate_list(certs) do
      {:ok, certificates, signer_infos}
    else
      _ -> :error
    end
  end

  defp certificate_list(nil), do: {:ok, []}

  defp certificate_list(value) do
    with {:ok, choices} <- Der.children(value) do
      # Only plain X.509 certificates (SEQUENCE); other CertificateChoices are skipped.
      {:ok, for({{:universal, true, 16}, _, raw} <- choices, do: raw)}
    end
  end

  defp signers(set) do
    with {:ok, infos} <- Der.children(set) do
      infos
      |> Enum.reduce_while({:ok, []}, fn info, {:ok, acc} ->
        case signer(info) do
          {:ok, signer} -> {:cont, {:ok, [signer | acc]}}
          error -> {:halt, error}
        end
      end)
      |> case do
        {:ok, []} -> :error
        {:ok, list} when length(list) > @max_signers -> :error
        {:ok, list} -> {:ok, Enum.reverse(list)}
        error -> error
      end
    end
  end

  # SignerInfo ::= SEQUENCE { version, sid, digestAlgorithm, signedAttrs [0] IMPLICIT OPTIONAL,
  #   signatureAlgorithm, signature OCTET STRING, unsignedAttrs [1] IMPLICIT OPTIONAL }
  defp signer(info) do
    with {:ok, [_version, sid, digest_alg | rest]} <- Der.children(info),
         {:ok, sid} <- sid(sid),
         {:ok, digest} <- Signature.digest(digest_alg),
         {:ok, signed_attrs, [sig_alg, signature | _unsigned]} <- signed_attrs(rest),
         {:ok, signature} <- Der.octet_string(signature),
         {:ok, attrs} <- attributes(signed_attrs) do
      {:ok,
       %{
         sid: sid,
         digest: digest,
         signature_algorithm: sig_alg,
         signed_attrs: signed_attrs,
         content_type: attrs[:content_type],
         message_digest: attrs[:message_digest],
         signature: signature
       }}
    else
      {:error, :unsupported_algorithm} = error -> error
      _ -> :error
    end
  end

  # IssuerAndSerialNumber ::= SEQUENCE { issuer Name, serialNumber } | [0] SubjectKeyIdentifier
  defp sid({{:universal, true, 16}, _, _} = element) do
    with {:ok, [{_, _, issuer_raw}, serial]} <- Der.children(element),
         {:ok, serial} <- Der.integer(serial) do
      {:ok, {:issuer_serial, issuer_raw, serial}}
    end
  end

  defp sid({{:context, false, 0}, ski, _}), do: {:ok, {:ski, ski}}
  defp sid(_other), do: :error

  # The signature covers the DER of the attributes with the SET OF tag (0x31),
  # not the [0] IMPLICIT tag they travel with (RFC 5652 §5.4).
  defp signed_attrs([{{:context, true, 0}, _value, <<_tag, rest::binary>>} | tail]),
    do: {:ok, <<0x31, rest::binary>>, tail}

  defp signed_attrs(rest), do: {:ok, nil, rest}

  defp attributes(nil), do: {:ok, %{}}

  defp attributes(der) do
    with {:ok, set} <- Der.decode(der), {:ok, list} <- Der.children(set) do
      Enum.reduce_while(list, {:ok, %{}}, fn attribute, {:ok, acc} ->
        case attribute(attribute) do
          {:ok, key, value} when not is_map_key(acc, key) ->
            {:cont, {:ok, Map.put(acc, key, value)}}

          # A repeated contentType/messageDigest makes the SignerInfo invalid.
          {:ok, _key, _value} ->
            {:halt, :error}

          :skip ->
            {:cont, {:ok, acc}}

          _error ->
            {:halt, :error}
        end
      end)
    end
  end

  defp attribute(attribute) do
    with {:ok, [type, values]} <- Der.children(attribute),
         {:ok, oid} <- Der.oid(type),
         {:ok, values} <- Der.children(values) do
      case {oid, values} do
        {@content_type_attr, [value]} ->
          with {:ok, value} <- Der.oid(value), do: {:ok, :content_type, value}

        {@message_digest_attr, [value]} ->
          with {:ok, value} <- Der.octet_string(value), do: {:ok, :message_digest, value}

        {oid, _values} when oid in [@content_type_attr, @message_digest_attr] ->
          :error

        _other ->
          :skip
      end
    end
  end

  defp lds_security_object(content) do
    with {:ok, lds} <- Der.decode(content),
         {:ok, [version, hash_alg, hashes | _version_info]} <- Der.children(lds),
         {:ok, version} when version in [0, 1] <- Der.integer(version),
         {:ok, hash_algorithm} <- Signature.digest(hash_alg),
         {:ok, list} <- Der.children(hashes),
         {:ok, hashes} <- data_group_hashes(list) do
      {:ok, %{hash_algorithm: hash_algorithm, hashes: hashes}}
    else
      {:error, :unsupported_algorithm} = error -> error
      _ -> :error
    end
  end

  defp data_group_hashes(list) do
    Enum.reduce_while(list, {:ok, %{}}, fn entry, {:ok, acc} ->
      with {:ok, [number, hash]} <- Der.children(entry),
           {:ok, number} when number in 1..16 and not is_map_key(acc, number) <-
             Der.integer(number),
           {:ok, hash} <- Der.octet_string(hash) do
        {:cont, {:ok, Map.put(acc, number, hash)}}
      else
        _ -> {:halt, :error}
      end
    end)
  end

  @doc "OID of the LDSSecurityObject content type."
  def lds_security_object_oid, do: @lds_security_object
end
