defmodule Cherry.Storage.R2 do
  @moduledoc """
  Almacenamiento en Cloudflare R2 o en cualquier servicio S3 compatible
  (MinIO, Garage, Ceph RGW...).

  El móvil sube directamente al bucket con una URL SigV4 prefirmada (path-style)
  que firma `Content-Type` e `If-None-Match: *`, de modo que no puede
  sobrescribir un objeto ya subido. `verify_upload/1` consulta el objeto por la
  API autenticada (HEAD + lectura parcial condicionada por ETag); `promote/2`
  lo copia de la zona de espera (`pending/`) a su clave definitiva y
  `delete_object/1` borra objetos (fotos borradas, cuentas borradas, subidas
  abandonadas).

  El bucket debe ser privado, sin dominio público ni r2.dev. Las URLs guardadas
  son referencias sin autorización; solo al serializar una respuesta ya
  autorizada se firma un GET de cinco minutos. Nunca se firma `pending/`.

  Sin `:endpoint` se usa R2 (`https://<account_id>.r2.cloudflarestorage.com`,
  región `auto`). Con `:endpoint` (env `S3_ENDPOINT`, p. ej.
  `http://minio.lan:9000`) se usa ese servicio y `:region` (env `S3_REGION`).
  """

  @behaviour Cherry.Storage

  alias Cherry.Storage

  @config_key __MODULE__
  @algorithm "AWS4-HMAC-SHA256"
  @default_region "auto"
  @service "s3"
  @signed_headers "content-type;host;if-none-match"
  @payload_hash "UNSIGNED-PAYLOAD"

  @impl Cherry.Storage
  def upload_config(now \\ DateTime.utc_now()) do
    with {:ok, config} <- config(),
         {:ok, expires_at} <- expires_at(config, now) do
      {:ok,
       %{
         allowed_content_types: Keyword.fetch!(config, :allowed_content_types),
         max_upload_bytes: Keyword.fetch!(config, :max_upload_bytes),
         expires_at: expires_at,
         ttl_seconds: Keyword.fetch!(config, :upload_url_ttl_seconds)
       }}
    end
  end

  @impl Cherry.Storage
  def presign_put(storage_key, content_type, now \\ DateTime.utc_now()) do
    with {:ok, config} <- config(),
         {:ok, expires_at} <- expires_at(config, now) do
      access_key_id = Keyword.fetch!(config, :access_key_id)
      secret_access_key = Keyword.fetch!(config, :secret_access_key)
      ttl_seconds = Keyword.fetch!(config, :upload_url_ttl_seconds)
      region = region(config)
      endpoint = endpoint(config)

      canonical_uri = object_path(config, endpoint, storage_key)
      amz_date = Calendar.strftime(now, "%Y%m%dT%H%M%SZ")
      date_scope = Calendar.strftime(now, "%Y%m%d")
      credential_scope = "#{date_scope}/#{region}/#{@service}/aws4_request"

      query = [
        {"X-Amz-Algorithm", @algorithm},
        {"X-Amz-Credential", "#{access_key_id}/#{credential_scope}"},
        {"X-Amz-Date", amz_date},
        {"X-Amz-Expires", Integer.to_string(ttl_seconds)},
        {"X-Amz-SignedHeaders", @signed_headers}
      ]

      canonical_query = canonical_query_string(query)

      canonical_headers =
        "content-type:#{content_type}\nhost:#{endpoint.host_header}\nif-none-match:*\n"

      canonical_request =
        ["PUT", canonical_uri, canonical_query, canonical_headers, @signed_headers, @payload_hash]
        |> Enum.join("\n")

      string_to_sign =
        [@algorithm, amz_date, credential_scope, sha256_hex(canonical_request)]
        |> Enum.join("\n")

      signature =
        secret_access_key
        |> signing_key(date_scope, region)
        |> hmac(string_to_sign)
        |> Base.encode16(case: :lower)

      upload_url =
        "#{endpoint.origin}#{canonical_uri}?#{canonical_query}&X-Amz-Signature=#{signature}"

      {:ok,
       %{
         storage_key: storage_key,
         upload_url: upload_url,
         public_url: endpoint.origin <> canonical_uri,
         method: "PUT",
         headers: %{"Content-Type" => content_type, "If-None-Match" => "*"},
         expires_at: expires_at,
         max_bytes: Keyword.fetch!(config, :max_upload_bytes)
       }}
    end
  end

  @doc "Checks the stored object's size, declared MIME and image signature before publishing it."
  @impl Cherry.Storage
  def verify_upload(intent) do
    with {:ok, config} <- config(),
         {:ok, head} <- object_request(config, intent.storage_key, :head),
         :ok <- validate_metadata(head, intent, config),
         [etag] <- Req.Response.get_header(head, "etag"),
         {:ok, sample} <-
           object_request(config, intent.storage_key, :get,
             headers: [
               {"range", "bytes=0-#{Storage.signature_sample_bytes() - 1}"},
               {"if-match", etag}
             ],
             into: &collect_sample/2
           ),
         true <-
           sample.status == 206 and Storage.image_signature?(sample.body, intent.content_type) do
      :ok
    else
      {:error, reason} -> {:error, reason}
      false -> {:error, :upload_invalid_image}
      _ -> {:error, :storage_unavailable}
    end
  end

  @impl Cherry.Storage
  def public_url(storage_key) do
    with {:ok, config} <- config() do
      endpoint = endpoint(config)
      {:ok, endpoint.origin <> object_path(config, endpoint, storage_key)}
    end
  end

  @doc "Temporary bearer URL. Call only for a photo the current viewer may see."
  def presign_get(storage_key, now \\ DateTime.utc_now()) do
    with {:ok, config} <- config(),
         true <- readable_key?(storage_key) do
      endpoint = endpoint(config)
      path = object_path(config, endpoint, storage_key)
      ttl = config[:read_url_ttl_seconds]
      date = Calendar.strftime(now, "%Y%m%d")
      amz_date = Calendar.strftime(now, "%Y%m%dT%H%M%SZ")
      scope = "#{date}/#{region(config)}/s3/aws4_request"

      query =
        canonical_query_string([
          {"X-Amz-Algorithm", @algorithm},
          {"X-Amz-Credential", "#{config[:access_key_id]}/#{scope}"},
          {"X-Amz-Date", amz_date},
          {"X-Amz-Expires", to_string(ttl)},
          {"X-Amz-SignedHeaders", "host"},
          {"response-cache-control", "private, no-store, max-age=0"}
        ])

      request =
        Enum.join(
          ["GET", path, query, "host:#{endpoint.host_header}\n", "host", @payload_hash],
          "\n"
        )

      to_sign = Enum.join([@algorithm, amz_date, scope, sha256_hex(request)], "\n")

      signature =
        config[:secret_access_key]
        |> signing_key(date, region(config))
        |> hmac(to_sign)
        |> Base.encode16(case: :lower)

      {:ok, "#{endpoint.origin}#{path}?#{query}&X-Amz-Signature=#{signature}"}
    else
      false -> {:error, :invalid_photo_key}
      error -> error
    end
  end

  @doc "Resolve our stored references, including URLs predating the private bucket migration."
  def storage_key(url) when is_binary(url) do
    with {:ok, config} <- config() do
      endpoint = endpoint(config)
      bases = [endpoint.origin <> object_path(config, endpoint, ""), config[:public_url_base]]

      Enum.find_value(bases, fn base ->
        prefix = if is_binary(base), do: String.trim_trailing(base, "/") <> "/"

        if prefix && String.starts_with?(url, prefix) do
          key = url |> String.replace_prefix(prefix, "") |> URI.decode()
          if readable_key?(key), do: key
        end
      end)
    else
      _ -> nil
    end
  end

  def storage_key(_), do: nil

  defp readable_key?(key) when is_binary(key) do
    String.starts_with?(key, ["photos/", "profiles/"]) and
      not Enum.any?(String.split(key, "/"), &(&1 in ["", ".", ".."])) and
      not String.contains?(key, ["?", "#", "\\", <<0>>])
  end

  defp readable_key?(_), do: false

  @doc "Authenticated existence check used by isolated recovery; errors never mean missing."
  def object_exists?(key) do
    with {:ok, config} <- config() do
      case object_request(config, key, :head) do
        {:ok, _} -> {:ok, true}
        {:error, :upload_object_not_found} -> {:ok, false}
        error -> error
      end
    end
  end

  @doc "Authenticated object inventory, used only during isolated recovery."
  def list_objects(token \\ nil, acc \\ []) do
    with {:ok, config} <- config() do
      params = [{"list-type", "2"}, {"max-keys", "1000"}]
      params = if token, do: params ++ [{"continuation-token", token}], else: params

      with {:ok, %{body: xml}} <- object_request(config, "", :get, params: params),
           true <- String.contains?(xml, "<ListBucketResult") and not String.contains?(xml, "<!"),
           keys <-
             Regex.scan(~r/<Key>([^<]+)<\/Key>/, xml, capture: :all_but_first) |> List.flatten(),
           true <-
             Enum.all?(
               keys,
               fn key ->
                 Regex.match?(~r/^(pending\/)?(photos|profiles)\/[a-zA-Z0-9_.\/-]+$/, key) and
                   readable_key?(Storage.published_key(key) || key)
               end
             ) do
        if String.contains?(xml, "<IsTruncated>false</IsTruncated>") do
          {:ok, acc ++ keys}
        else
          case Regex.run(~r/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/, xml) do
            [_, next] when next != token ->
              list_objects(String.replace(next, "&amp;", "&"), acc ++ keys)

            _ ->
              {:error, :invalid_object_listing}
          end
        end
      else
        _ -> {:error, :storage_unavailable}
      end
    end
  end

  @doc "Server-side copy (`x-amz-copy-source`) followed by a delete of the source."
  @impl Cherry.Storage
  def promote(from_key, to_key) do
    with {:ok, config} <- config(),
         {:ok, _copy} <-
           object_request(config, to_key, :put,
             headers: [
               {"x-amz-copy-source",
                "/#{encode_path(config[:bucket_name])}/#{encode_path(from_key)}"}
             ]
           ) do
      case object_request(config, from_key, :delete) do
        {:ok, _deleted} -> :ok
        # The copy is published; the sweeper removes the leftover later.
        {:error, :upload_object_not_found} -> :ok
        {:error, _reason} -> :ok
      end
    end
  end

  @impl Cherry.Storage
  def delete_object(storage_key) do
    with {:ok, config} <- config() do
      case object_request(config, storage_key, :delete) do
        {:ok, _response} -> :ok
        {:error, :upload_object_not_found} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp object_request(config, storage_key, method, opts \\ []) do
    endpoint = endpoint(config)

    options = [
      method: method,
      url: endpoint.origin <> object_path(config, endpoint, storage_key),
      aws_sigv4: [
        access_key_id: config[:access_key_id],
        secret_access_key: config[:secret_access_key],
        region: region(config),
        service: @service
      ],
      retry: false,
      redirect: false,
      decode_body: false,
      compressed: false,
      receive_timeout: 5_000
    ]

    case Req.request(
           options
           |> Keyword.merge(opts)
           |> Keyword.merge(Keyword.get(config, :request_options, []))
         ) do
      {:ok, %{status: status} = response} when status in [200, 204, 206] -> {:ok, response}
      {:ok, %{status: 404}} -> {:error, :upload_object_not_found}
      {:ok, %{status: 412}} -> {:error, :upload_object_changed}
      _ -> {:error, :storage_unavailable}
    end
  end

  defp validate_metadata(response, intent, config) do
    size =
      case Req.Response.get_header(response, "content-length") do
        [value] ->
          case Integer.parse(value) do
            {size, ""} -> size
            _ -> nil
          end

        _ ->
          nil
      end

    cond do
      not is_integer(size) or size <= 0 or size > config[:max_upload_bytes] or
          size != intent.size_bytes ->
        {:error, :upload_size_mismatch}

      Req.Response.get_header(response, "content-type") != [intent.content_type] ->
        {:error, :upload_content_type_mismatch}

      true ->
        :ok
    end
  end

  # Even a server ignoring Range cannot make us buffer an entire object.
  defp collect_sample({:data, data}, {request, response}) do
    body = (response.body || "") <> data

    if byte_size(body) <= Storage.signature_sample_bytes() do
      {:cont, {request, %{response | body: body}}}
    else
      {:halt, {request, %{response | body: nil}}}
    end
  end

  defp config do
    config = Application.get_env(:cherry, @config_key, [])

    required = [:access_key_id, :secret_access_key, :bucket_name]

    if Enum.all?(required, &configured?(Keyword.get(config, &1))) and
         (configured?(Keyword.get(config, :account_id)) or valid_endpoint?(config[:endpoint])) do
      {:ok,
       Keyword.merge(
         [
           allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
           max_upload_bytes: 2_000_000,
           upload_url_ttl_seconds: 600,
           read_url_ttl_seconds: 300
         ],
         config
       )}
    else
      {:error, :storage_not_configured}
    end
  end

  defp configured?(value), do: is_binary(value) and String.trim(value) != ""

  defp valid_endpoint?(value) do
    configured?(value) and
      match?(
        %URI{scheme: scheme, host: host}
        when scheme in ["http", "https"] and host not in [nil, ""],
        URI.parse(String.trim(value))
      )
  end

  # Base URL, Host header value and optional path prefix of the S3 API.
  defp endpoint(config) do
    if valid_endpoint?(config[:endpoint]) do
      uri = URI.parse(String.trim(config[:endpoint]))
      default_port = if uri.scheme == "http", do: 80, else: 443

      host_header =
        if uri.port in [nil, default_port], do: uri.host, else: "#{uri.host}:#{uri.port}"

      %{
        origin: "#{uri.scheme}://#{host_header}",
        host_header: host_header,
        base_path: String.trim_trailing(uri.path || "", "/")
      }
    else
      host = "#{config[:account_id]}.r2.cloudflarestorage.com"
      %{origin: "https://#{host}", host_header: host, base_path: ""}
    end
  end

  defp region(config) do
    case Keyword.get(config, :region) do
      region when is_binary(region) and region != "" -> String.trim(region)
      _unset -> @default_region
    end
  end

  # Path-style addressing (`/<bucket>/<key>`) works on R2, MinIO and Garage.
  defp object_path(config, endpoint, storage_key) do
    "#{endpoint.base_path}/#{encode_path(config[:bucket_name])}/#{encode_path(storage_key)}"
  end

  defp expires_at(config, now) do
    {:ok, DateTime.add(now, Keyword.fetch!(config, :upload_url_ttl_seconds), :second)}
  rescue
    _error -> {:error, :storage_not_configured}
  end

  defp signing_key(secret_access_key, date_scope, region) do
    ("AWS4" <> secret_access_key)
    |> hmac(date_scope)
    |> hmac(region)
    |> hmac(@service)
    |> hmac("aws4_request")
  end

  defp hmac(key, data), do: :crypto.mac(:hmac, :sha256, key, data)
  defp sha256_hex(value), do: :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)

  defp canonical_query_string(query) do
    query
    |> Enum.sort_by(fn {key, _value} -> key end)
    |> Enum.map_join("&", fn {key, value} -> "#{uri_encode(key)}=#{uri_encode(value)}" end)
  end

  defp encode_path(path) do
    path
    |> String.split("/", trim: true)
    |> Enum.map_join("/", &uri_encode/1)
  end

  defp uri_encode(value), do: URI.encode(to_string(value), &URI.char_unreserved?/1)
end
