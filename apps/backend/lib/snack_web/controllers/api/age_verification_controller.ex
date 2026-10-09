defmodule SnackWeb.Controllers.Api.AgeVerificationController do
  @moduledoc """
  `GET /api/me/verification` and `POST /api/me/verification/nfc`.

  The NFC body carries DG1, DG2 and EF.SOD in base64 (`dg1`, `dg2`, `sod`).
  They are filtered from the request logs (`:filter_parameters`) and dropped
  after the response; see `Snack.Identity.AgeVerifications`.
  """
  use SnackWeb, :controller

  alias Snack.Identity.{AgeVerification, AgeVerifications}

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
      required: AgeVerifications.required?()
    })
  end

  def create_nfc(conn, params) do
    with {:ok, document} <- decode(params),
         {:ok, verification} <- AgeVerifications.verify_nfc(conn.assigns.current_user, document) do
      json(conn, %{verification: serialize(verification), required: AgeVerifications.required?()})
    else
      {:error, reason} -> error(conn, reason)
    end
  end

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

  defp error(conn, :underage), do: send_error(conn, 422, "underage")
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
