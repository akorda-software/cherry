defmodule CherryWeb.Controllers.Api.UploadController do
  @moduledoc """
  `PUT /api/uploads/:token` — destino de subida del almacenamiento local
  (`Cherry.Storage.Local`), equivalente a la URL prefirmada de R2/S3.

  No lleva Bearer: el token firmado del intent autoriza exactamente una storage
  key, un MIME y un tamaño máximo hasta su caducidad. El cuerpo crudo se lee por
  fragmentos (Plug.Parsers lo deja pasar sin leer gracias a `pass: ["*/*"]`), se
  valida la cabecera JPEG/PNG/WebP y se publica de forma atómica. Un objeto ya
  existente nunca se sobrescribe (412, como `If-None-Match: *`).

  Errores: 403 `upload_token_invalid`/`upload_token_expired`,
  415 `upload_content_type_mismatch`, 413 `upload_too_large`,
  422 `upload_invalid_image`, 412 `upload_already_exists`,
  503 `storage_unavailable`; 404 si la instancia no usa almacenamiento local.
  """
  use CherryWeb, :controller

  alias Cherry.Storage.Local

  @chunk_bytes 64_000
  @read_timeout_ms 15_000

  def create(conn, %{"token" => token}) do
    with :ok <- ensure_local_storage(),
         {:ok, claims} <- Local.verify_upload_token(token),
         :ok <- validate_content_type(conn, claims.content_type),
         :ok <- validate_declared_length(conn, claims.max_bytes),
         {:ok, upload} <- Local.begin_upload(claims),
         conn = maybe_send_continue(conn),
         {:ok, conn, upload} <- read_body_into(conn, upload),
         :ok <- Local.finish_upload(upload) do
      json(conn, %{ok: true})
    else
      {:error, %Plug.Conn{} = conn, reason} -> error_response(conn, reason)
      {:error, reason} -> error_response(conn, reason)
    end
  end

  defp ensure_local_storage do
    if Cherry.Storage.adapter() == Local, do: :ok, else: {:error, :not_found}
  end

  defp validate_content_type(conn, expected) do
    actual =
      case get_req_header(conn, "content-type") do
        [value | _] -> value |> String.split(";") |> hd() |> String.trim() |> String.downcase()
        [] -> nil
      end

    if actual == expected, do: :ok, else: {:error, :upload_content_type_mismatch}
  end

  # Early rejection before reading anything; the streamed byte count is still
  # enforced for chunked bodies or lying headers.
  defp validate_declared_length(conn, max_bytes) do
    with [value | _] <- get_req_header(conn, "content-length"),
         {length, ""} <- Integer.parse(value),
         true <- length > max_bytes do
      {:error, :upload_too_large}
    else
      _within_limit_or_unknown -> :ok
    end
  end

  # Bandit does not answer `Expect: 100-continue` by itself (curl waits 1 s for
  # it on bodies > 1 MB). Everything that can reject the request without the
  # body has been checked at this point, so invite the client to send it.
  defp maybe_send_continue(conn) do
    if Enum.any?(get_req_header(conn, "expect"), &(String.downcase(&1) == "100-continue")),
      do: inform(conn, 100, []),
      else: conn
  end

  defp read_body_into(conn, upload) do
    stream_chunks(conn, upload)
  rescue
    exception ->
      # Timeouts/disconnects raise from the adapter: never leave temp files.
      Local.abort_upload(upload)
      reraise exception, __STACKTRACE__
  end

  defp stream_chunks(conn, upload) do
    case read_body(conn,
           length: @chunk_bytes,
           read_length: @chunk_bytes,
           read_timeout: @read_timeout_ms
         ) do
      {:ok, chunk, conn} ->
        case Local.append_chunk(upload, chunk) do
          {:ok, upload} -> {:ok, conn, upload}
          {:error, reason} -> {:error, conn, reason}
        end

      {:more, chunk, conn} ->
        case Local.append_chunk(upload, chunk) do
          {:ok, upload} -> stream_chunks(conn, upload)
          {:error, reason} -> {:error, conn, reason}
        end

      {:error, _reason} ->
        Local.abort_upload(upload)
        {:error, :upload_incomplete}
    end
  end

  defp error_response(conn, reason) do
    status =
      case reason do
        :not_found -> :not_found
        reason when reason in [:upload_token_invalid, :upload_token_expired] -> :forbidden
        :upload_content_type_mismatch -> :unsupported_media_type
        :upload_too_large -> :request_entity_too_large
        :upload_invalid_image -> :unprocessable_entity
        :upload_already_exists -> :precondition_failed
        :upload_incomplete -> :bad_request
        _unavailable -> :service_unavailable
      end

    error = if reason == :not_found, do: "not_found", else: Atom.to_string(reason)

    conn
    |> put_status(status)
    |> json(%{error: error})
  end
end
