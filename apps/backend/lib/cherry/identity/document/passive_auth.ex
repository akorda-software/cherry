defmodule Cherry.Identity.Document.PassiveAuth do
  @moduledoc """
  Passive authentication of an eMRTD (ICAO 9303-11 §5.1) on the server.

  Given the raw DG1 and EF.SOD read from the chip:

    1. parses the SOD (CMS SignedData with an LDSSecurityObject);
    2. finds the Document Signer certificate inside the SOD and verifies the
       SignerInfo signature (signed attributes, content type and message digest);
    3. validates the Document Signer against a trusted CSCA (issuer, key
       identifiers, signature, validity periods, key usage, unknown critical
       extensions);
    4. checks that the hash of DG1 matches the one signed in the SOD;
    5. parses the MRZ of DG1.

  It proves the data was issued by the State and not altered. It does not prove
  the chip is the original (active/chip authentication) nor that the holder is
  the person using the phone. DG2 (the photo) is not needed for the age and is
  never read.

  Nothing here logs or stores its input: callers must discard the data groups
  once this returns.
  """

  alias Cherry.Identity.Document.{Certificate, Mrz, Signature, Sod, TrustStore}

  @type error ::
          :malformed_sod
          | :unsupported_algorithm
          | :missing_document_signer
          | :invalid_signature
          | :untrusted_certificate
          | :certificate_expired
          | :data_group_mismatch
          | Mrz.error()

  @type result :: %{
          mrz: Mrz.t(),
          document_signer: Certificate.t(),
          csca: Certificate.t(),
          certificate_expired: boolean()
        }

  @doc """
  Options:

    * `:trust_anchors` — CSCA certificates (`%Certificate{}`); defaults to
      `TrustStore.anchors/0`.
    * `:now` — `DateTime` used for validity periods and ages (default: now).
    * `:allow_expired_certificates` — when `true`, an expired Document Signer
      or CSCA does not fail the check: the signatures still prove the data is
      genuine, and the result says `certificate_expired: true`. The caller
      must then refuse the document itself (after looking at the age, so that
      a minor's old document is still treated as a minor's).
  """
  @spec verify(%{dg1: binary(), sod: binary()}, keyword()) ::
          {:ok, result()} | {:error, error()}
  def verify(%{dg1: dg1, sod: sod}, opts \\ []) when is_binary(dg1) and is_binary(sod) do
    now = Keyword.get_lazy(opts, :now, &DateTime.utc_now/0)
    anchors = Keyword.get_lazy(opts, :trust_anchors, &TrustStore.anchors/0)

    with {:ok, sod} <- Sod.parse(sod),
         :ok <- content_type(sod),
         {:ok, signer, csca, expired} <- verify_signers(sod, anchors, now),
         :ok <- data_group(sod, 1, dg1),
         {:ok, mrz} <- Mrz.parse_dg1(dg1, DateTime.to_date(now)),
         :ok <- check_expired(expired, Keyword.get(opts, :allow_expired_certificates, false)) do
      {:ok, %{mrz: mrz, document_signer: signer, csca: csca, certificate_expired: expired}}
    end
  end

  @doc """
  Checks the signers of a CMS SignedData parsed with `Sod.parse_signed_data/1`
  (a CSCA master list): the signer certificate must be in it, chain to one of
  `anchors` and have signed the content. Returns the signer, its CSCA and
  whether either is out of its validity period at `now`.
  """
  @spec verify_signed(Sod.t(), [Certificate.t()], DateTime.t()) ::
          {:ok, Certificate.t(), Certificate.t(), boolean()} | {:error, error()}
  def verify_signed(%Sod{} = signed_data, anchors, %DateTime{} = now),
    do: verify_signers(signed_data, anchors, now)

  defp check_expired(true, false), do: {:error, :certificate_expired}
  defp check_expired(_expired, _allowed), do: :ok

  @doc """
  Public, non-personal facts about an EF.SOD for debugging a rejection in
  development: the Document Signer certificate (issuer, subject, validity,
  algorithms), the LDS digest and which data groups the chip has. These are
  shared by every document of a series; nothing read from DG1, no hash and
  no document number is included.
  """
  @spec diagnose(binary()) :: map()
  def diagnose(sod) when is_binary(sod) do
    case Sod.parse(sod) do
      {:ok, %Sod{} = parsed} ->
        %{
          content_type: parsed.content_type,
          lds_digest: parsed.hash_algorithm,
          data_groups: parsed.hashes |> Map.keys() |> Enum.sort(),
          signers:
            Enum.map(parsed.signers, fn signer ->
              %{
                digest: signer.digest,
                signature_algorithm: algorithm_name(signer.signature_algorithm),
                signed_attributes: signer.signed_attrs != nil,
                sid: elem(signer.sid, 0)
              }
            end),
          certificates: Enum.map(parsed.certificates, &describe_certificate/1)
        }

      {:error, reason} ->
        %{error: reason, size: byte_size(sod), first_byte: :binary.first(sod <> <<0>>)}
    end
  end

  defp describe_certificate(der) do
    case Certificate.parse(der) do
      {:ok, cert} ->
        %{
          subject: Certificate.describe_name(cert.subject),
          issuer: Certificate.describe_name(cert.issuer),
          not_before: cert.not_before,
          not_after: cert.not_after,
          key: elem(cert.public_key, 0),
          signature_algorithm: algorithm_name(cert.signature_algorithm),
          authority_key_id: cert.authority_key_id && Base.encode16(cert.authority_key_id),
          unknown_critical_extensions: cert.unknown_critical_extensions
        }

      {:error, reason} ->
        %{error: reason}
    end
  end

  defp algorithm_name(element) do
    case Signature.algorithm_identifier(element) do
      {:ok, oid, _params} -> oid
      _ -> :unreadable
    end
  end

  defp content_type(%Sod{content_type: type}) do
    if type == Sod.lds_security_object_oid(), do: :ok, else: {:error, :malformed_sod}
  end

  defp data_group(%Sod{hashes: hashes, hash_algorithm: digest}, number, data) do
    case Map.fetch(hashes, number) do
      {:ok, expected} ->
        if constant_time_equal?(Signature.hash(digest, data), expected),
          do: :ok,
          else: {:error, :data_group_mismatch}

      :error ->
        {:error, :data_group_mismatch}
    end
  end

  # ICAO recommends a single SignerInfo; any one that fully verifies is enough.
  # One with certificates in force is preferred over one with expired ones.
  defp verify_signers(%Sod{signers: signers} = sod, anchors, now) do
    Enum.reduce_while(signers, nil, fn signer, best ->
      case verify_signer(sod, signer, anchors, now) do
        {:ok, _cert, _csca, false} = ok -> {:halt, ok}
        {:ok, _cert, _csca, true} = expired -> {:cont, prefer(best, expired)}
        {:error, _reason} = error -> {:cont, best || error}
      end
    end)
  end

  defp prefer({:ok, _cert, _csca, _expired} = best, _other), do: best
  defp prefer(_error_or_nil, other), do: other

  defp verify_signer(sod, signer, anchors, now) do
    # The chain is checked first: the Document Signer's key (chosen by whoever
    # built the SOD) is only used once a trusted CSCA has vouched for it.
    # Validity periods are reported, not enforced here (see `verify/2`).
    with {:ok, cert} <- signer_certificate(sod, signer),
         :ok <- document_signer_profile(cert),
         {:ok, csca} <- trusted_issuer(cert, anchors),
         :ok <- signer_info_signature(sod, signer, cert) do
      {:ok, cert, csca,
       not (Certificate.valid_at?(cert, now) and Certificate.valid_at?(csca, now))}
    end
  end

  defp signer_certificate(%Sod{certificates: certificates}, %{sid: sid}) do
    certificates
    |> Stream.map(&Certificate.parse/1)
    |> Enum.find_value({:error, :missing_document_signer}, fn
      {:ok, cert} -> if identifies?(sid, cert), do: {:ok, cert}
      _error -> nil
    end)
  end

  defp identifies?({:issuer_serial, issuer_raw, serial}, %Certificate{} = cert) do
    serial == cert.serial and
      (issuer_raw == cert.issuer.raw or same_raw_name?(issuer_raw, cert.issuer))
  end

  defp identifies?({:ski, ski}, %Certificate{subject_key_id: ski}) when is_binary(ski), do: true
  defp identifies?(_sid, _cert), do: false

  # Compare a raw Name from the SignerInfo with the normalised issuer.
  defp same_raw_name?(raw, issuer) do
    case Certificate.parse_name(raw) do
      {:ok, name} -> Certificate.same_name?(name, issuer)
      _ -> false
    end
  end

  defp signer_info_signature(%Sod{} = sod, signer, cert) do
    with {:ok, algorithm} <- Signature.algorithm(signer.signature_algorithm, signer.digest),
         {:ok, signed} <- signed_bytes(sod, signer) do
      if Signature.verify(algorithm, signed, signer.signature, cert.public_key),
        do: :ok,
        else: {:error, :invalid_signature}
    end
  end

  # With signed attributes (always present in ICAO SODs) the signature covers
  # them, and they bind the content through contentType and messageDigest.
  defp signed_bytes(%Sod{content: content}, %{signed_attrs: nil}), do: {:ok, content}

  defp signed_bytes(%Sod{} = sod, signer) do
    digest = Signature.hash(signer.digest, sod.content)

    cond do
      signer.content_type != sod.content_type -> {:error, :invalid_signature}
      not is_binary(signer.message_digest) -> {:error, :invalid_signature}
      not constant_time_equal?(signer.message_digest, digest) -> {:error, :invalid_signature}
      true -> {:ok, signer.signed_attrs}
    end
  end

  defp document_signer_profile(%Certificate{} = cert) do
    cond do
      cert.unknown_critical_extensions != [] ->
        {:error, :untrusted_certificate}

      cert.ca? == true ->
        {:error, :untrusted_certificate}

      is_list(cert.key_usage) and :digital_signature not in cert.key_usage ->
        {:error, :untrusted_certificate}

      true ->
        :ok
    end
  end

  defp trusted_issuer(%Certificate{} = cert, anchors) do
    anchors
    |> Enum.filter(&issuer_candidate?(cert, &1))
    |> Enum.find(&Certificate.signed_by?(cert, &1))
    |> case do
      %Certificate{} = csca -> {:ok, csca}
      nil -> {:error, :untrusted_certificate}
    end
  end

  defp issuer_candidate?(cert, csca) do
    Certificate.same_name?(cert.issuer, csca.subject) and
      key_ids_compatible?(cert.authority_key_id, csca.subject_key_id) and
      TrustStore.usable_anchor?(csca)
  end

  defp key_ids_compatible?(aki, ski) when is_binary(aki) and is_binary(ski), do: aki == ski
  defp key_ids_compatible?(_aki, _ski), do: true

  defp constant_time_equal?(a, b) when byte_size(a) == byte_size(b),
    do: :crypto.hash_equals(a, b)

  defp constant_time_equal?(_a, _b), do: false
end
