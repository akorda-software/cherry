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

  `.ml` and `.mls` files are CSCA master lists (ICAO 9303-12, CMS with
  eContentType 2.23.136.1.1.2). Without `--signed-by` **their signature is not
  verified**: before adding an extracted certificate, check its fingerprint
  against the official source. `--export` writes one PEM per certificate.

  To import a whole master list into the trust store:

      mix cherry.csca GermanMasterList.ml --signed-by csca-germany.pem \
        --export-countries priv/csca

  `--signed-by` takes the CSCA of the State that publishes the list (checked
  beforehand against its official fingerprint) and refuses the list unless its
  signer certificate chains to it and signed it. `--export-countries` (only
  with `--signed-by`) writes each certificate to `<dir>/<country>/`, by the
  country of its subject, skipping the ones already in `<dir>`. Procedure in
  `priv/csca/README.md`.
  """

  use Mix.Task

  alias Cherry.Identity.Document.{Certificate, Der, PassiveAuth, Sod, TrustStore}

  @impl Mix.Task
  def run(args) do
    {opts, paths, _} =
      OptionParser.parse(args,
        strict: [
          country: :string,
          export: :string,
          signed_by: :string,
          export_countries: :string
        ]
      )

    if opts[:export_countries] && !opts[:signed_by],
      do: Mix.raise("--export-countries needs --signed-by: only signed master lists are imported")

    if signed_by = opts[:signed_by], do: Enum.each(paths, &verify_master_list!(&1, signed_by))

    certificates =
      case paths do
        [] ->
          Mix.Task.run("app.config")
          Enum.map(TrustStore.reload(), & &1.der)

        paths ->
          Enum.flat_map(paths, &read/1)
      end

    if dir = opts[:export_countries] do
      certificates |> Enum.uniq() |> Enum.flat_map(&parse/1) |> export_countries(dir)
    else
      list(certificates, opts)
    end
  end

  defp list(certificates, opts) do
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
      master_list?(path) -> master_list(File.read!(path))
      true -> TrustStore.read_file(path)
    end
  end

  defp master_list?(path), do: String.downcase(Path.extname(path)) in [".ml", ".mls"]

  @master_list_type "2.23.136.1.1.2"

  # The signer certificate travels inside the list; it must chain to the given
  # CSCA (a CSCA of the publishing State) and have signed the list.
  defp verify_master_list!(path, signed_by) do
    unless master_list?(path), do: Mix.raise("--signed-by only applies to master lists: #{path}")

    anchors = signed_by |> TrustStore.read_file() |> Enum.flat_map(&parse/1)
    if anchors == [], do: Mix.raise("no certificate in #{signed_by}")

    with {:ok, signed} <- Sod.parse_signed_data(File.read!(path)),
         true <- signed.content_type == @master_list_type || {:error, :not_a_master_list},
         {:ok, signer, csca, expired} <-
           PassiveAuth.verify_signed(signed, anchors, DateTime.utc_now()) do
      Mix.shell().info("""
      #{Path.basename(path)}: signature OK
        signer: #{subject(signer)} (#{signer.not_before} → #{signer.not_after})
        CSCA:   #{subject(csca)} (SHA-256 #{hash(:sha256, csca.der)})
      """)

      if expired,
        do: Mix.shell().error("  warning: the signer or its CSCA is out of its validity period\n")
    else
      {:error, reason} -> Mix.raise("#{path}: master list signature not valid (#{reason})")
    end
  end

  defp export_countries(certs, dir) do
    existing =
      if File.dir?(dir),
        do: dir |> TrustStore.files() |> Enum.flat_map(&TrustStore.read_file/1) |> MapSet.new(),
        else: MapSet.new()

    {added, skipped} =
      Enum.reduce(certs, {%{}, 0}, fn cert, {added, skipped} ->
        country = country(cert)

        cond do
          MapSet.member?(existing, cert.der) ->
            {added, skipped}

          not TrustStore.usable_anchor?(cert) or not Regex.match?(~r/\A[a-z]{2}\z/, country || "") ->
            Mix.shell().error("skipping #{subject(cert)}: not a usable CSCA with a country")
            {added, skipped + 1}

          true ->
            path =
              Path.join([
                dir,
                country,
                "csca-#{country}-#{String.slice(hash(:sha256, cert.der), 0, 16)}.pem"
              ])

            File.mkdir_p!(Path.dirname(path))
            File.write!(path, :public_key.pem_encode([{:Certificate, cert.der, :not_encrypted}]))
            {Map.update(added, country, 1, &(&1 + 1)), skipped}
        end
      end)

    total = added |> Map.values() |> Enum.sum()

    Mix.shell().info(
      "#{total} new certificate(s) in #{map_size(added)} countries, #{skipped} skipped" <>
        if(total > 0,
          do: ": " <> Enum.map_join(Enum.sort(added), ", ", fn {c, n} -> "#{c} #{n}" end),
          else: ""
        )
    )
  end

  defp country(cert) do
    case List.keyfind(cert.subject.normalized, "2.5.4.6", 0) do
      {_, country} -> country
      nil -> nil
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
