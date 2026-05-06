defmodule Snack.Storage.R2 do
  @moduledoc false

  @config_key __MODULE__
  @algorithm "AWS4-HMAC-SHA256"
  @region "auto"
  @service "s3"
  @signed_headers "host"
  @payload_hash "UNSIGNED-PAYLOAD"

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

  def presign_put(storage_key, content_type, now \\ DateTime.utc_now()) do
    with {:ok, config} <- config(),
         {:ok, expires_at} <- expires_at(config, now) do
      account_id = Keyword.fetch!(config, :account_id)
      bucket_name = Keyword.fetch!(config, :bucket_name)
      access_key_id = Keyword.fetch!(config, :access_key_id)
      secret_access_key = Keyword.fetch!(config, :secret_access_key)
      public_url_base = Keyword.fetch!(config, :public_url_base)
      ttl_seconds = Keyword.fetch!(config, :upload_url_ttl_seconds)

      host = "#{account_id}.r2.cloudflarestorage.com"
      canonical_uri = "/#{encode_path(bucket_name)}/#{encode_path(storage_key)}"
      amz_date = Calendar.strftime(now, "%Y%m%dT%H%M%SZ")
      date_scope = Calendar.strftime(now, "%Y%m%d")
      credential_scope = "#{date_scope}/#{@region}/#{@service}/aws4_request"

      query = [
        {"X-Amz-Algorithm", @algorithm},
        {"X-Amz-Credential", "#{access_key_id}/#{credential_scope}"},
        {"X-Amz-Date", amz_date},
        {"X-Amz-Expires", Integer.to_string(ttl_seconds)},
        {"X-Amz-SignedHeaders", @signed_headers}
      ]

      canonical_query = canonical_query_string(query)
      canonical_headers = "host:#{host}\n"

      canonical_request =
        ["PUT", canonical_uri, canonical_query, canonical_headers, @signed_headers, @payload_hash]
        |> Enum.join("\n")

      string_to_sign =
        [@algorithm, amz_date, credential_scope, sha256_hex(canonical_request)]
        |> Enum.join("\n")

      signature =
        secret_access_key
        |> signing_key(date_scope)
        |> hmac(string_to_sign)
        |> Base.encode16(case: :lower)

      upload_url =
        "https://#{host}#{canonical_uri}?#{canonical_query}&X-Amz-Signature=#{signature}"

      {:ok,
       %{
         storage_key: storage_key,
         upload_url: upload_url,
         public_url: public_url(public_url_base, storage_key),
         method: "PUT",
         headers: %{"Content-Type" => content_type},
         expires_at: expires_at,
         max_bytes: Keyword.fetch!(config, :max_upload_bytes)
       }}
    end
  end

  defp config do
    config = Application.get_env(:snack, @config_key, [])

    required = [:account_id, :access_key_id, :secret_access_key, :bucket_name, :public_url_base]

    if Enum.all?(required, &configured?(Keyword.get(config, &1))) do
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

  defp expires_at(config, now) do
    {:ok, DateTime.add(now, Keyword.fetch!(config, :upload_url_ttl_seconds), :second)}
  rescue
    _error -> {:error, :storage_not_configured}
  end

  defp signing_key(secret_access_key, date_scope) do
    ("AWS4" <> secret_access_key)
    |> hmac(date_scope)
    |> hmac(@region)
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

  defp public_url(base, storage_key) do
    String.trim_trailing(base, "/") <> "/" <> encode_path(storage_key)
  end
end
