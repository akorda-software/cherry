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

  Un bucket con acceso público expone también `pending/`: las claves son
  aleatorias y el barrido las borra al caducar el intent, pero conviene añadir
  una regla de ciclo de vida que borre `pending/` a 1 día.

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
         public_url: build_public_url(Keyword.fetch!(config, :public_url_base), storage_key),
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
      {:ok, build_public_url(Keyword.fetch!(config, :public_url_base), storage_key)}
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

    required = [:access_key_id, :secret_access_key, :bucket_name, :public_url_base]

    if Enum.all?(required, &configured?(Keyword.get(config, &1))) and
         (configured?(Keyword.get(config, :account_id)) or valid_endpoint?(config[:endpoint])) do
      {:ok,
       Keyword.merge(
         [
           allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
           max_upload_bytes: 2_000_000,
           upload_url_ttl_seconds: 600
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

  defp build_public_url(base, storage_key) do
    String.trim_trailing(base, "/") <> "/" <> encode_path(storage_key)
  end
end
