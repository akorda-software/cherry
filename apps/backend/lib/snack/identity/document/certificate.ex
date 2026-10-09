defmodule Snack.Identity.Document.Certificate do
  @moduledoc """
  The parts of an X.509 certificate that eMRTD passive authentication needs
  (CSCA and Document Signer certificates, ICAO 9303-12).

  Parsed with `Snack.Identity.Document.Der` instead of `:public_key` because
  OTP 28 rejects certificates whose EC key carries explicit domain parameters,
  which ICAO recommends.
  """

  import Bitwise

  alias Snack.Identity.Document.{Der, Signature}

  @enforce_keys [:der, :tbs, :signature_algorithm, :signature, :serial, :issuer, :subject]
  defstruct [
    :der,
    :tbs,
    :signature_algorithm,
    :signature,
    :serial,
    :issuer,
    :subject,
    :not_before,
    :not_after,
    :public_key,
    :subject_key_id,
    :authority_key_id,
    :ca?,
    :key_usage,
    unknown_critical_extensions: []
  ]

  @type t :: %__MODULE__{}

  @key_usage_bits [
    :digital_signature,
    :non_repudiation,
    :key_encipherment,
    :data_encipherment,
    :key_agreement,
    :key_cert_sign,
    :crl_sign
  ]

  # Extensions we understand or that ICAO profiles may mark critical without
  # changing what passive authentication relies on.
  @known_extensions MapSet.new([
                      # subjectKeyIdentifier, keyUsage, privateKeyUsagePeriod
                      "2.5.29.14",
                      "2.5.29.15",
                      "2.5.29.16",
                      # subjectAltName, issuerAltName, basicConstraints
                      "2.5.29.17",
                      "2.5.29.18",
                      "2.5.29.19",
                      # cRLDistributionPoints, certificatePolicies, authorityKeyIdentifier
                      "2.5.29.31",
                      "2.5.29.32",
                      "2.5.29.35",
                      # extKeyUsage, ICAO documentTypeList, ICAO nameChange
                      "2.5.29.37",
                      "2.23.136.1.1.6.2",
                      "2.23.136.1.1.6.1"
                    ])

  @named_curves %{
    "1.2.840.10045.3.1.7" => :secp256r1,
    "1.3.132.0.33" => :secp224r1,
    "1.3.132.0.34" => :secp384r1,
    "1.3.132.0.35" => :secp521r1,
    "1.3.36.3.3.2.8.1.1.5" => :brainpoolP224r1,
    "1.3.36.3.3.2.8.1.1.7" => :brainpoolP256r1,
    "1.3.36.3.3.2.8.1.1.9" => :brainpoolP320r1,
    "1.3.36.3.3.2.8.1.1.11" => :brainpoolP384r1,
    "1.3.36.3.3.2.8.1.1.13" => :brainpoolP512r1
  }

  @doc "Parses a DER certificate."
  @spec parse(binary()) :: {:ok, t()} | {:error, :malformed_certificate}
  def parse(der) when is_binary(der) do
    with {:ok, cert} <- Der.decode(der),
         {:ok, [tbs, sig_alg, {{:universal, false, 3}, <<0, signature::binary>>, _}]} <-
           Der.children(cert),
         {:ok, fields} <- Der.children(tbs),
         {:ok, parsed} <- parse_tbs(fields) do
      {:ok,
       struct!(
         __MODULE__,
         Map.merge(parsed, %{
           der: der,
           tbs: elem(tbs, 2),
           signature_algorithm: sig_alg,
           signature: signature
         })
       )}
    else
      _ -> {:error, :malformed_certificate}
    end
  end

  def parse(_der), do: {:error, :malformed_certificate}

  # TBSCertificate ::= SEQUENCE { version [0] EXPLICIT DEFAULT v1, serialNumber,
  #   signature, issuer, validity, subject, subjectPublicKeyInfo,
  #   issuerUniqueID [1], subjectUniqueID [2], extensions [3] EXPLICIT }
  defp parse_tbs([{{:context, true, 0}, _, _} | rest]), do: parse_tbs(rest)

  defp parse_tbs([serial, _sig_alg, issuer, validity, subject, spki | optional]) do
    with {:ok, serial} <- Der.integer(serial),
         {:ok, not_before, not_after} <- validity(validity),
         {:ok, public_key} <- public_key(spki),
         {:ok, extensions} <- extensions(optional) do
      {:ok,
       Map.merge(extensions, %{
         serial: serial,
         issuer: name(issuer),
         subject: name(subject),
         not_before: not_before,
         not_after: not_after,
         public_key: public_key
       })}
    end
  end

  defp parse_tbs(_fields), do: :error

  # Names are compared by their normalised attributes (type + trimmed,
  # case-folded value), so PrintableString vs UTF8String does not matter.
  defp name({{:universal, true, 16}, _, raw} = name) do
    normalized =
      with {:ok, rdns} <- Der.children(name) do
        Enum.flat_map(rdns, fn rdn ->
          case Der.children(rdn) do
            {:ok, atvs} -> Enum.map(atvs, &attribute/1)
            _ -> [:invalid]
          end
        end)
      end

    %{raw: raw, normalized: normalized}
  end

  defp name(_other), do: %{raw: nil, normalized: :invalid}

  defp attribute(atv) do
    with {:ok, [type, {_tag, value, _raw}]} <- Der.children(atv),
         {:ok, oid} <- Der.oid(type) do
      {oid, value |> String.trim() |> String.replace(~r/\s+/u, " ") |> String.downcase()}
    else
      _ -> :invalid
    end
  end

  @doc "Parses a DER Name (e.g. the issuer of a CMS SignerInfo)."
  def parse_name(raw) when is_binary(raw) do
    case Der.decode(raw) do
      {:ok, {{:universal, true, 16}, _, _} = element} -> {:ok, name(element)}
      _ -> {:error, :malformed}
    end
  end

  @doc "True when `issuer` (a name of a certificate) designates `subject`."
  def same_name?(%{raw: raw}, %{raw: raw}) when is_binary(raw), do: true

  def same_name?(%{normalized: a}, %{normalized: b}) when is_list(a) and is_list(b),
    do: a == b and :invalid not in a

  def same_name?(_a, _b), do: false

  defp validity(validity) do
    with {:ok, [not_before, not_after]} <- Der.children(validity),
         {:ok, not_before} <- time(not_before),
         {:ok, not_after} <- time(not_after) do
      {:ok, not_before, not_after}
    end
  end

  # UTCTime: YYMMDDHHMMSSZ (YY >= 50 → 19YY). GeneralizedTime: YYYYMMDDHHMMSSZ.
  defp time({{:universal, false, 23}, <<yy::binary-2, rest::binary-10, "Z">>, _}) do
    with {year, ""} <- Integer.parse(yy) do
      datetime(if(year >= 50, do: 1900, else: 2000) + year, rest)
    end
  end

  defp time({{:universal, false, 24}, <<yyyy::binary-4, rest::binary-10, "Z">>, _}) do
    with {year, ""} <- Integer.parse(yyyy), do: datetime(year, rest)
  end

  defp time(_other), do: :error

  defp datetime(year, <<mo::binary-2, d::binary-2, h::binary-2, mi::binary-2, s::binary-2>>) do
    with [{mo, ""}, {d, ""}, {h, ""}, {mi, ""}, {s, ""}] <-
           Enum.map([mo, d, h, mi, s], &Integer.parse/1),
         {:ok, naive} <- NaiveDateTime.new(year, mo, d, h, mi, s) do
      {:ok, DateTime.from_naive!(naive, "Etc/UTC")}
    else
      _ -> :error
    end
  end

  # SubjectPublicKeyInfo ::= SEQUENCE { algorithm, subjectPublicKey BIT STRING }
  defp public_key(spki) do
    with {:ok, [algorithm, {{:universal, false, 3}, <<0, key::binary>>, _}]} <-
           Der.children(spki),
         {:ok, oid, params} <- Signature.algorithm_identifier(algorithm) do
      key_for(oid, params, key)
    else
      _ -> :error
    end
  end

  # rsaEncryption or id-RSASSA-PSS: RSAPublicKey ::= SEQUENCE { n, e }
  defp key_for(oid, _params, key)
       when oid in ["1.2.840.113549.1.1.1", "1.2.840.113549.1.1.10"] do
    with {:ok, rsa} <- Der.decode(key),
         {:ok, [n, e]} <- Der.children(rsa),
         {:ok, n} when n > 0 <- Der.integer(n),
         {:ok, e} when e > 0 <- Der.integer(e) do
      {:ok, {:rsa, :binary.encode_unsigned(n), :binary.encode_unsigned(e)}}
    else
      _ -> :error
    end
  end

  # id-ecPublicKey: named curve OID or explicit ECParameters.
  defp key_for("1.2.840.10045.2.1", params, point) do
    with {:ok, curve} <- curve(params), do: {:ok, {:ec, point, curve}}
  end

  defp key_for(_oid, _params, _key), do: {:ok, :unsupported}

  defp curve({{:universal, false, 6}, _, _} = oid) do
    with {:ok, oid} <- Der.oid(oid), {:ok, curve} <- Map.fetch(@named_curves, oid) do
      {:ok, curve}
    else
      _ -> :error
    end
  end

  # ECParameters ::= SEQUENCE { version, fieldID SEQUENCE { prime-field, p },
  #   curve SEQUENCE { a, b, seed BIT STRING OPTIONAL }, base, order, cofactor OPTIONAL }
  defp curve({{:universal, true, 16}, _, _} = params) do
    with {:ok, [_version, field_id, curve, base, order | cofactor]} <- Der.children(params),
         {:ok, [field_type, prime]} <- Der.children(field_id),
         {:ok, "1.2.840.10045.1.1"} <- Der.oid(field_type),
         {:ok, p} when p > 0 <- Der.integer(prime),
         {:ok, [a, b | _seed]} <- Der.children(curve),
         {:ok, a} <- Der.octet_string(a),
         {:ok, b} <- Der.octet_string(b),
         {:ok, g} <- Der.octet_string(base),
         {:ok, n} when n > 0 <- Der.integer(order),
         {:ok, h} <- cofactor(cofactor) do
      {:ok,
       {{:prime_field, :binary.encode_unsigned(p)}, {a, b, :none}, g, :binary.encode_unsigned(n),
        :binary.encode_unsigned(h)}}
    else
      _ -> :error
    end
  end

  defp curve(_params), do: :error

  defp cofactor([]), do: {:ok, 1}
  defp cofactor([h | _]), do: Der.integer(h)

  defp extensions([]), do: {:ok, %{}}
  defp extensions([{{:context, true, 1}, _, _} | rest]), do: extensions(rest)
  defp extensions([{{:context, true, 2}, _, _} | rest]), do: extensions(rest)

  defp extensions([{{:context, true, 3}, value, _}]) do
    with {:ok, sequence} <- Der.decode(value),
         {:ok, list} <- Der.children(sequence) do
      Enum.reduce_while(list, {:ok, %{}}, fn extension, {:ok, acc} ->
        case extension(extension, acc) do
          {:ok, acc} -> {:cont, {:ok, acc}}
          _error -> {:halt, :error}
        end
      end)
    end
  end

  defp extensions(_other), do: :error

  # Extension ::= SEQUENCE { extnID, critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING }
  defp extension(extension, acc) do
    with {:ok, fields} <- Der.children(extension),
         {oid, critical?, value} <- split_extension(fields),
         {:ok, oid} <- Der.oid(oid),
         {:ok, value} <- Der.octet_string(value) do
      apply_extension(oid, critical?, value, acc)
    else
      _ -> :error
    end
  end

  defp split_extension([oid, {{:universal, false, 1}, <<flag>>, _}, value]),
    do: {oid, flag != 0, value}

  defp split_extension([oid, value]), do: {oid, false, value}
  defp split_extension(_fields), do: :error

  defp apply_extension("2.5.29.14", _critical?, value, acc) do
    with {:ok, element} <- Der.decode(value), {:ok, ski} <- Der.octet_string(element) do
      {:ok, Map.put(acc, :subject_key_id, ski)}
    end
  end

  # AuthorityKeyIdentifier ::= SEQUENCE { keyIdentifier [0] IMPLICIT OCTET STRING OPTIONAL, ... }
  defp apply_extension("2.5.29.35", _critical?, value, acc) do
    with {:ok, element} <- Der.decode(value), {:ok, fields} <- Der.children(element) do
      aki = Enum.find_value(fields, fn {tag, v, _} -> if tag == {:context, false, 0}, do: v end)
      {:ok, Map.put(acc, :authority_key_id, aki)}
    end
  end

  # BasicConstraints ::= SEQUENCE { cA BOOLEAN DEFAULT FALSE, pathLenConstraint OPTIONAL }
  defp apply_extension("2.5.29.19", _critical?, value, acc) do
    with {:ok, element} <- Der.decode(value), {:ok, fields} <- Der.children(element) do
      ca? = match?([{{:universal, false, 1}, <<flag>>, _} | _] when flag != 0, fields)
      {:ok, Map.put(acc, :ca?, ca?)}
    end
  end

  defp apply_extension("2.5.29.15", _critical?, value, acc) do
    case Der.decode(value) do
      {:ok, {{:universal, false, 3}, <<_unused, bits::binary>>, _}} ->
        flags = :binary.decode_unsigned(bits <> <<0, 0>>)
        size = (byte_size(bits) + 2) * 8

        usages =
          for {usage, index} <- Enum.with_index(@key_usage_bits),
              (flags >>> (size - 1 - index) &&& 1) == 1,
              do: usage

        {:ok, Map.put(acc, :key_usage, usages)}

      _ ->
        :error
    end
  end

  defp apply_extension(oid, true, _value, acc) do
    if MapSet.member?(@known_extensions, oid) do
      {:ok, acc}
    else
      {:ok, Map.update(acc, :unknown_critical_extensions, [oid], &[oid | &1])}
    end
  end

  defp apply_extension(_oid, false, _value, acc), do: {:ok, acc}

  @doc "Verifies that `cert` was signed by the key of `issuer`."
  @spec signed_by?(t(), t()) :: boolean()
  def signed_by?(%__MODULE__{} = cert, %__MODULE__{public_key: key}) do
    case Signature.algorithm(cert.signature_algorithm) do
      {:ok, algorithm} -> Signature.verify(algorithm, cert.tbs, cert.signature, key)
      _ -> false
    end
  end

  @doc "True when `at` is inside the validity period."
  @spec valid_at?(t(), DateTime.t()) :: boolean()
  def valid_at?(%__MODULE__{not_before: nb, not_after: na}, %DateTime{} = at) do
    DateTime.compare(at, nb) != :lt and DateTime.compare(at, na) != :gt
  end

  @doc "SHA-256 of the DER, hex encoded (for logs and documentation)."
  def fingerprint(%__MODULE__{der: der}),
    do: :crypto.hash(:sha256, der) |> Base.encode16(case: :lower)
end
