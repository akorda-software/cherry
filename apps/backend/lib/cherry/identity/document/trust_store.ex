defmodule Cherry.Identity.Document.TrustStore do
  @moduledoc """
  Trusted CSCA certificates (Country Signing Certificate Authorities) for
  passive authentication.

  Configured with:

      config :cherry, Cherry.Identity.Document.TrustStore,
        paths: ["/path/to/csca"],   # directories or files (.pem, .crt, .cer, .der)
        countries: ["es"],          # country folders of the bundled priv/csca
        certificates: []            # DER binaries (tests)

  Without `paths` nor `countries` the whole `priv/csca` of the release is
  trusted. `paths` (`CSCA_PATHS`, comma separated) replaces it; `countries`
  (`CSCA_COUNTRIES`) trusts only those folders of `priv/csca` (`es` is Spain),
  added to `paths` when both are set. Directories are read recursively. A PEM
  file may contain several certificates. Files that do not parse are skipped
  with a warning (never fatal: a broken file must not take the API down).

  The parsed list is cached in `:persistent_term`; call `reload/0` after
  updating the files. Sources and the update procedure: `priv/csca/README.md`.
  """

  require Logger

  alias Cherry.Identity.Document.Certificate

  @cache_key {__MODULE__, :anchors}
  @extensions ~w(.pem .crt .cer .der)

  @doc "Trusted CSCA certificates (cached)."
  @spec anchors() :: [Certificate.t()]
  def anchors do
    config = config()

    case :persistent_term.get(@cache_key, nil) do
      {^config, anchors} ->
        anchors

      _stale ->
        anchors = load(config)
        :persistent_term.put(@cache_key, {config, anchors})
        anchors
    end
  end

  @doc """
  Countries with a usable CSCA: ISO 3166-1 alpha-2 codes in upper case, sorted,
  from the `C` of each certificate's subject. Also non-State issuers such as
  `EU` and `UN` (laissez-passer) and `KS` (Kosovo).
  """
  @spec countries() :: [String.t()]
  def countries do
    anchors()
    |> Enum.filter(&usable_anchor?/1)
    |> Enum.flat_map(fn cert ->
      case List.keyfind(cert.subject.normalized, "2.5.4.6", 0) do
        {_, <<_, _>> = country} -> [String.upcase(country)]
        _other -> []
      end
    end)
    |> Enum.uniq()
    |> Enum.sort()
  end

  @doc "Re-reads the configured sources."
  @spec reload() :: [Certificate.t()]
  def reload do
    :persistent_term.erase(@cache_key)
    anchors()
  end

  @doc """
  A CSCA can anchor a chain if it is a CA (when it says so) and may sign
  certificates (when it declares a key usage).
  """
  @spec usable_anchor?(Certificate.t()) :: boolean()
  def usable_anchor?(%Certificate{} = cert) do
    cert.ca? != false and
      (cert.key_usage == nil or :key_cert_sign in cert.key_usage) and
      cert.unknown_critical_extensions == []
  end

  defp config do
    config = Application.get_env(:cherry, __MODULE__, [])
    {sources(config), Keyword.get(config, :certificates, [])}
  end

  defp sources(config) do
    bundled =
      case Keyword.get(config, :countries) do
        nil -> if Keyword.has_key?(config, :paths), do: [], else: [default_path()]
        countries -> Enum.map(countries, &Path.join(default_path(), &1))
      end

    Keyword.get(config, :paths, []) ++ bundled
  end

  defp default_path, do: Application.app_dir(:cherry, "priv/csca")

  defp load({paths, certificates}) do
    from_files = paths |> Enum.flat_map(&safe_files/1) |> Enum.flat_map(&read_file/1)

    (certificates ++ from_files)
    |> Enum.uniq()
    |> Enum.flat_map(fn der ->
      case Certificate.parse(der) do
        {:ok, cert} ->
          [cert]

        {:error, _} ->
          Logger.warning("CSCA trust store: skipping a certificate that does not parse")
          []
      end
    end)
  end

  defp safe_files(path) do
    unless File.exists?(path), do: Logger.warning("CSCA trust store: #{path} does not exist")
    files(path)
  rescue
    error ->
      Logger.warning("CSCA trust store: cannot list #{path}: #{inspect(error.__struct__)}")
      []
  end

  @doc false
  def files(path) do
    cond do
      File.dir?(path) ->
        path
        |> File.ls!()
        |> Enum.sort()
        |> Enum.flat_map(&files(Path.join(path, &1)))

      File.regular?(path) and String.downcase(Path.extname(path)) in @extensions ->
        [path]

      true ->
        []
    end
  end

  @doc "DER certificates in a PEM or DER file."
  @spec read_file(Path.t()) :: [binary()]
  def read_file(path) do
    case File.read(path) do
      {:ok, content} ->
        # PEM files may carry text (e.g. `openssl x509 -text`) around the blocks.
        if String.contains?(content, "-----BEGIN CERTIFICATE-----") do
          try do
            for {:Certificate, der, :not_encrypted} <- :public_key.pem_decode(content), do: der
          rescue
            _ ->
              Logger.warning("CSCA trust store: #{path} is not valid PEM")
              []
          end
        else
          [content]
        end

      {:error, reason} ->
        Logger.warning("CSCA trust store: cannot read #{path}: #{inspect(reason)}")
        []
    end
  end
end
