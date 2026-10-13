defmodule CherryWeb.Controllers.Api.AgeVerificationController do
  @moduledoc """
  `GET /api/me/verification`, `POST /api/me/verification/nfc` and the
  external provider (Didit, selfie + document): `POST /api/me/verification/provider`
  starts a session the app opens in a browser and `POST
  /api/me/verification/provider/check` reads its decision.

  The NFC body carries DG1, DG2 and EF.SOD in base64 (`dg1`, `dg2`, `sod`).
  They are filtered from the request logs (`:filter_parameters`) and dropped
  after the response; see `Cherry.Identity.AgeVerifications`.

  A minor's document erases the whole account (`Cherry.Accounts.purge_account/1`)
  and answers 422 `{"error": "underage", "accountDeleted": true}`, whatever
  the method.
  """
  use CherryWeb, :controller

  alias Cherry.Accounts
  alias Cherry.Identity.{AgeVerification, AgeVerifications}

  # Generous bounds for real chips: DG1 is ~100 bytes, DG2 a 10–60 KB JPEG or
  # JPEG 2000 photo, EF.SOD 2–5 KB with the Document Signer certificate.
  @fields [{"dg1", :dg1, 1_024}, {"dg2", :dg2, 262_144}, {"sod", :sod, 32_768}]

  # Passive authentication failures: the document could not be proven genuine.
  @not_authentic [
    :malformed_sod,
    :unsupported_algorithm,
    :missing_document_signer,
    :invalid_signature,
    :untrusted_certificate,
    :certificate_expired,
    :data_group_mismatch,
    :malformed_dg1,
    :invalid_check_digit,
    :unsupported_document
  ]

  def show(conn, _params) do
    user = conn.assigns.current_user

    json(conn, %{
      verification: serialize(AgeVerifications.get(user.id)),
      required: AgeVerifications.required?(),
      providerAvailable: AgeVerifications.provider_available?()
    })
  end

  def create_nfc(conn, params) do
    user = conn.assigns.current_user

    with {:ok, document} <- decode(params),
         {:ok, verification} <- AgeVerifications.verify_nfc(user, document) do
      json(conn, %{verification: serialize(verification), required: AgeVerifications.required?()})
    else
      {:error, :underage} ->
        underage(conn, user)

      {:error, reason} ->
        error(conn, reason)
    end
  end

  def create_provider(conn, params) do
    user = conn.assigns.current_user

    with {:ok, callback} <- callback(params["callback"]),
         {:ok, session} <- AgeVerifications.start_provider(user, callback) do
      conn
      |> put_status(201)
      |> json(%{sessionId: session.session_id, url: session.url})
    else
      {:error, reason} -> provider_error(conn, user, reason)
    end
  end

  def check_provider(conn, params) do
    user = conn.assigns.current_user

    with {:ok, session_id} <- session_id(params["sessionId"]) do
      case AgeVerifications.check_provider(user, session_id) do
        {:ok, verification} ->
          json(conn, %{
            result: "verified",
            verification: serialize(verification),
            required: AgeVerifications.required?()
          })

        {:pending, :in_progress} ->
          json(conn, %{result: "pending"})

        {:pending, :in_review} ->
          json(conn, %{result: "in_review"})

        {:error, reason} ->
          provider_error(conn, user, reason)
      end
    else
      {:error, reason} -> provider_error(conn, user, reason)
    end
  end

  # Where Didit sends the user back: the app's own scheme or https. Never
  # plain http, nor schemes that run code or read files.
  @callback_format ~r/\A[a-z][a-z0-9+.-]*:\/\/[^\s]*\z/
  @refused_schemes ["http", "file", "javascript", "data", "vbscript"]

  defp callback(nil), do: {:ok, nil}

  defp callback(value) when is_binary(value) and byte_size(value) <= 200 do
    with true <- Regex.match?(@callback_format, value),
         [scheme | _] = String.split(value, ":", parts: 2),
         false <- scheme in @refused_schemes do
      {:ok, value}
    else
      _ -> {:error, :invalid_payload}
    end
  end

  defp callback(_value), do: {:error, :invalid_payload}

  defp session_id(value) when is_binary(value) do
    case Ecto.UUID.cast(value) do
      {:ok, uuid} -> {:ok, uuid}
      :error -> {:error, :invalid_payload}
    end
  end

  defp session_id(_value), do: {:error, :invalid_payload}

  defp underage(conn, user) do
    deleted = match?({:ok, _}, Accounts.purge_account(user))
    send_error(conn, 422, "underage", %{accountDeleted: deleted})
  end

  defp provider_error(conn, user, :underage), do: underage(conn, user)

  defp provider_error(conn, _user, :unsupported_document),
    do: send_error(conn, 422, "unsupported_document")

  defp provider_error(conn, _user, :verification_declined),
    do: send_error(conn, 422, "verification_declined")

  defp provider_error(conn, _user, :session_expired),
    do: send_error(conn, 422, "session_expired")

  defp provider_error(conn, _user, :session_not_found),
    do: send_error(conn, 404, "session_not_found")

  defp provider_error(conn, _user, :provider_error),
    do: send_error(conn, 502, "provider_error")

  defp provider_error(conn, _user, reason), do: error(conn, reason)

  defp decode(params) do
    Enum.reduce_while(@fields, {:ok, %{}}, fn {key, field, max}, {:ok, acc} ->
      with value when is_binary(value) <- params[key],
           # base64 is 4/3 of the size, plus room for line breaks.
           true <- byte_size(value) <= div(max * 4, 3) + div(max, 16) + 8,
           {:ok, bin} when byte_size(bin) > 0 and byte_size(bin) <= max <-
             Base.decode64(value, ignore: :whitespace) do
        {:cont, {:ok, Map.put(acc, field, bin)}}
      else
        _ -> {:halt, {:error, :invalid_payload}}
      end
    end)
  end

  defp serialize(%AgeVerification{status: "verified"} = v),
    do: %{status: "verified", method: v.method, verifiedAt: v.verified_at}

  defp serialize(%AgeVerification{status: status, method: method}),
    do: %{status: status, method: method, verifiedAt: nil}

  defp serialize(nil), do: %{status: "unverified", method: nil, verifiedAt: nil}

  defp error(conn, :invalid_payload), do: send_error(conn, 422, "invalid_payload")

  defp error(conn, reason) when reason in @not_authentic,
    do: send_error(conn, 422, "document_not_verified", %{reason: Atom.to_string(reason)})

  defp error(conn, :document_expired), do: send_error(conn, 422, "document_expired")
  defp error(conn, :document_already_used), do: send_error(conn, 409, "document_already_used")
  defp error(conn, :already_verified), do: send_error(conn, 409, "already_verified")
  defp error(conn, :verification_revoked), do: send_error(conn, 403, "verification_revoked")

  defp error(conn, {:too_many_attempts, retry_after}) do
    conn
    |> put_resp_header("retry-after", Integer.to_string(retry_after))
    |> send_error(429, "too_many_attempts", %{retryAfter: retry_after})
  end

  defp error(conn, :unavailable), do: send_error(conn, 503, "age_verification_unavailable")
  defp error(conn, _internal), do: send_error(conn, 500, "verification_error")

  defp send_error(conn, status, code, extra \\ %{}) do
    conn |> put_status(status) |> json(Map.put(extra, :error, code))
  end
end
