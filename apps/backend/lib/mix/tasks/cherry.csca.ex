defmodule Mix.Tasks.Cherry.Csca do
  @shortdoc "Lists CSCA certificates (trust store, files or a CSCA master list)"

  @moduledoc """
  Inspects CSCA certificates to review the trust store or update it.

      mix cherry.csca                          # the configured trust store
      mix cherry.csca priv/csca/es/new.pem     # files or directories
      mix cherry.csca GermanMasterList.ml --country ES --export /tmp/es

  For each certificate: subject, validity, key, SHA-1 and SHA-256 of the DER
  (to compare with the fingerprints published by the issuing State) and
  whether passive authentication can use it as an anchor.

  `.ml` files are CSCA master lists (ICAO 9303-12, CMS with eContentType
  2.23.136.1.1.2). **Their signature is not verified here**: before adding an
  extracted certificate, check its fingerprint against the official source
  (procedure in `priv/csca/README.md`). `--export` writes one PEM per
  certificate; nothing is added to the trust store automatically.
  """

  use Mix.Task

  alias Cherry.Identity.Document.{Certificate, Der, TrustStore}

  @impl Mix.Task
  def run(args) do
    {opts, paths, _} = OptionParser.parse(args, strict: [country: :string, export: :string])

    certificates =
      case paths do
        [] ->
          Mix.Task.run("app.config")
          Enum.map(TrustStore.reload(), & &1.der)

        paths ->
          Enum.flat_map(paths, &read/1)
      end

    certificates
    |> Enum.uniq()
    |> Enum.flat_map(&parse/1)
    |> filter_country(opts[:country])
    |> Enum.sort_by(&DateTime.to_unix(&1.not_before))
    |> tap(fn certs -> Mix.shell().info("#{length(certs)} certificate(s)\n") end)
    |> Enum.each(fn cert ->
      describe(cert)
      if dir = opts[:export], do: export(cert, dir)
    end)
  end

  defp read(path) do
    cond do
      File.dir?(path) -> path |> TrustStore.files() |> Enum.flat_map(&TrustStore.read_file/1)
      String.ends_with?(path, ".ml") -> master_list(File.read!(path))
      true -> TrustStore.read_file(path)
    end
  end

  # ContentInfo → SignedData → eContent (CscaMasterList ::= SEQUENCE { version, SET OF Certificate })
  @doc false
  def master_list(bin) do
    with {:ok, content_info} <- Der.decode(bin),
         {:ok, [_type, {{:context, true, 0}, explicit, _}]} <- Der.children(content_info),
         {:ok, signed_data} <- Der.decode(explicit),
         {:ok, [_version, _digests, encap | _]} <- Der.children(signed_data),
         {:ok, [type, {{:context, true, 0}, content, _}]} <- Der.children(encap),
         {:ok, "2.23.136.1.1.2"} <- Der.oid(type),
         {:ok, octets} <- Der.decode(content),
         {:ok, list} <- Der.octet_string(octets),
         {:ok, master_list} <- Der.decode(list),
         {:ok, [_version, set]} <- Der.children(master_list),
         {:ok, certs} <- Der.children(set) do
      for {_tag, _value, raw} <- certs, do: raw
    else
      _ -> Mix.raise("not a CSCA master list")
    end
  end

  defp parse(der) do
    case Certificate.parse(der) do
      {:ok, cert} ->
        [cert]

      {:error, _} ->
        Mix.shell().error("skipping a certificate that does not parse")
        []
    end
  end

  defp filter_country(certs, nil), do: certs

  defp filter_country(certs, country) do
    country = String.downcase(country)

    Enum.filter(
      certs,
      &match?({"2.5.4.6", ^country}, List.keyfind(&1.subject.normalized, "2.5.4.6", 0))
    )
  end

  defp describe(cert) do
    Mix.shell().info("""
    #{subject(cert)}
      issuer:   #{if Certificate.same_name?(cert.issuer, cert.subject), do: "(self)", else: name(cert.issuer)}
      validity: #{cert.not_before} → #{cert.not_after}
      key:      #{key(cert.public_key)}
      anchor:   #{TrustStore.usable_anchor?(cert)}#{if Certificate.signed_by?(cert, cert), do: " (self-signed, signature ok)", else: ""}
      SHA-1:    #{hash(:sha, cert.der)}
      SHA-256:  #{hash(:sha256, cert.der)}
    """)
  end

  defp subject(cert), do: Certificate.describe_name(cert.subject)
  defp name(name), do: Certificate.describe_name(name)

  defp key({:rsa, n, _e}), do: "RSA #{bit_size(n)}"
  defp key({:ec, _point, curve}) when is_atom(curve), do: "EC #{curve}"
  defp key({:ec, _point, _explicit}), do: "EC (explicit parameters)"
  defp key(_other), do: "unsupported"

  defp hash(type, der), do: :crypto.hash(type, der) |> Base.encode16()

  defp export(cert, dir) do
    File.mkdir_p!(dir)
    path = Path.join(dir, "csca-#{String.slice(hash(:sha256, cert.der), 0, 16)}.pem")
    File.write!(path, :public_key.pem_encode([{:Certificate, cert.der, :not_encrypted}]))
    Mix.shell().info("  → #{path}\n")
  end
end
