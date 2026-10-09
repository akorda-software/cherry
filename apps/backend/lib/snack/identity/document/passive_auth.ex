defmodule Snack.Identity.Document.PassiveAuth do
  @moduledoc """
  Passive authentication of an eMRTD (ICAO 9303-11 §5.1) on the server.

  Given the raw DG1, DG2 and EF.SOD read from the chip:

    1. parses the SOD (CMS SignedData with an LDSSecurityObject);
    2. finds the Document Signer certificate inside the SOD and verifies the
       SignerInfo signature (signed attributes, content type and message digest);
    3. validates the Document Signer against a trusted CSCA (issuer, key
       identifiers, signature, validity periods, key usage, unknown critical
       extensions);
    4. checks that the hashes of DG1 and DG2 match the ones signed in the SOD;
    5. parses the MRZ of DG1.

  It proves the data was issued by the State and not altered. It does not prove
  the chip is the original (active/chip authentication) nor that the holder is
  the person using the phone (selfie comparison, a later phase).

  Nothing here logs or stores its input: callers must discard the data groups
  once this returns.
  """

  alias Snack.Identity.Document.{Certificate, Mrz, Signature, Sod, TrustStore}

  @type error ::
          :malformed_sod
          | :unsupported_algorithm
          | :missing_document_signer
          | :invalid_signature
          | :untrusted_certificate
          | :certificate_expired
          | :data_group_mismatch
          | Mrz.error()

  @type result :: %{mrz: Mrz.t(), document_signer: Certificate.t(), csca: Certificate.t()}

  @doc """
  Options:

    * `:trust_anchors` — CSCA certificates (`%Certificate{}`); defaults to
      `TrustStore.anchors/0`.
    * `:now` — `DateTime` used for validity periods and ages (default: now).
  """
  @spec verify(%{dg1: binary(), dg2: binary(), sod: binary()}, keyword()) ::
          {:ok, result()} | {:error, error()}
  def verify(%{dg1: dg1, dg2: dg2, sod: sod}, opts \\ [])
      when is_binary(dg1) and is_binary(dg2) and is_binary(sod) do
    now = Keyword.get_lazy(opts, :now, &DateTime.utc_now/0)
    anchors = Keyword.get_lazy(opts, :trust_anchors, &TrustStore.anchors/0)

    with {:ok, sod} <- Sod.parse(sod),
         :ok <- content_type(sod),
         {:ok, signer, csca} <- verify_signers(sod, anchors, now),
         :ok <- data_group(sod, 1, dg1),
         :ok <- data_group(sod, 2, dg2),
         {:ok, mrz} <- Mrz.parse_dg1(dg1, DateTime.to_date(now)) do
      {:ok, %{mrz: mrz, document_signer: signer, csca: csca}}
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
  defp verify_signers(%Sod{signers: signers} = sod, anchors, now) do
    Enum.reduce_while(signers, nil, fn signer, first_error ->
      case verify_signer(sod, signer, anchors, now) do
        {:ok, _cert, _csca} = ok -> {:halt, ok}
        {:error, _reason} = error -> {:cont, first_error || error}
      end
    end)
  end

  defp verify_signer(sod, signer, anchors, now) do
    with {:ok, cert} <- signer_certificate(sod, signer),
         :ok <- signer_info_signature(sod, signer, cert),
         :ok <- document_signer_profile(cert),
         {:ok, csca} <- trusted_issuer(cert, anchors),
         :ok <- valid_at(cert, now),
         :ok <- valid_at(csca, now) do
      {:ok, cert, csca}
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

  defp valid_at(cert, now) do
    if Certificate.valid_at?(cert, now), do: :ok, else: {:error, :certificate_expired}
  end

  defp constant_time_equal?(a, b) when byte_size(a) == byte_size(b),
    do: :crypto.hash_equals(a, b)

  defp constant_time_equal?(_a, _b), do: false
end
