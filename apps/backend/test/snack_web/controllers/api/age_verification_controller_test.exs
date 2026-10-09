defmodule SnackWeb.Controllers.Api.AgeVerificationControllerTest do
  use SnackWeb.ConnCase, async: false

  import ExUnit.CaptureLog
  import Snack.TestSupport.DatingFixtures

  alias Snack.Identity.Document.TrustStore
  alias Snack.TestSupport.DocumentPKI, as: PKI

  setup do
    previous = %{
      store: Application.get_env(:snack, TrustStore),
      age: Application.get_env(:snack, :age_verification),
      features: Application.get_env(:snack, :features)
    }

    on_exit(fn ->
      Application.put_env(:snack, TrustStore, previous.store)
      Application.put_env(:snack, :age_verification, previous.age)

      if previous.features,
        do: Application.put_env(:snack, :features, previous.features),
        else: Application.delete_env(:snack, :features)

      TrustStore.reload()
    end)

    csca = PKI.csca()
    Application.put_env(:snack, TrustStore, paths: [], certificates: [csca.der])
    user = user_fixture()

    %{csca: csca, ds: PKI.document_signer(csca), user: user, conn: authed_conn_for_user(user)}
  end

  defp body(doc) do
    %{
      "dg1" => Base.encode64(doc.dg1),
      "dg2" => Base.encode64(doc.dg2),
      "sod" => Base.encode64(doc.sod)
    }
  end

  defp document(ctx, opts \\ []), do: PKI.document([csca: ctx.csca, ds: ctx.ds] ++ opts)

  describe "GET /api/me/verification" do
    test "unverified by default", %{conn: conn} do
      assert %{
               "verification" => %{"status" => "unverified", "method" => nil, "verifiedAt" => nil},
               "required" => false
             } = conn |> get("/api/me/verification") |> json_response(200)
    end

    test "requires a session" do
      assert build_conn() |> get("/api/me/verification") |> json_response(401)
    end
  end

  describe "POST /api/me/verification/nfc" do
    test "verifies an adult's document", %{conn: conn} = ctx do
      response =
        conn |> post("/api/me/verification/nfc", body(document(ctx))) |> json_response(200)

      assert %{
               "verification" => %{
                 "status" => "verified",
                 "method" => "nfc_dni",
                 "verifiedAt" => at
               },
               "required" => false
             } = response

      assert {:ok, _, _} = DateTime.from_iso8601(at)

      assert %{"verification" => %{"status" => "verified"}} =
               authed_conn_for_user(ctx.user) |> get("/api/me/verification") |> json_response(200)
    end

    test "the raw body of the request is not kept on the connection", %{conn: conn} = ctx do
      response = post(conn, "/api/me/verification/nfc", body(document(ctx)))
      assert json_response(response, 200)
      refute Map.has_key?(response.private, :raw_body)
    end

    test "passports", %{conn: conn} = ctx do
      assert %{"verification" => %{"method" => "nfc_passport"}} =
               conn
               |> post("/api/me/verification/nfc", body(document(ctx, format: :td3)))
               |> json_response(200)
    end

    test "invalid payloads", %{conn: conn} = ctx do
      valid = body(document(ctx))

      for payload <- [
            %{},
            Map.delete(valid, "sod"),
            %{valid | "dg1" => "not base64!"},
            %{valid | "dg1" => ""},
            %{valid | "dg2" => 42},
            %{valid | "dg1" => Base.encode64(:binary.copy(<<0>>, 2_000))},
            %{valid | "sod" => Base.encode64(:binary.copy(<<0>>, 40_000))}
          ] do
        assert %{"error" => "invalid_payload"} =
                 conn |> post("/api/me/verification/nfc", payload) |> json_response(422)
      end
    end

    test "base64 with line breaks is accepted", %{conn: conn} = ctx do
      doc = document(ctx)

      wrapped =
        doc.sod
        |> Base.encode64()
        |> String.graphemes()
        |> Enum.chunk_every(76)
        |> Enum.join("\n")

      assert conn
             |> post("/api/me/verification/nfc", %{body(doc) | "sod" => wrapped})
             |> json_response(200)
    end

    test "documents that are not genuine", %{conn: conn} = ctx do
      doc = document(ctx)

      assert %{"error" => "document_not_verified", "reason" => "data_group_mismatch"} =
               conn
               |> post("/api/me/verification/nfc", body(%{doc | dg2: PKI.dg2()}))
               |> json_response(422)

      other = PKI.csca(cn: "CSCA UNKNOWN", key: PKI.key({:ec, :secp256r1}))

      foreign =
        PKI.document(csca: other, ds: PKI.document_signer(other, key: PKI.key({:ec, :secp256r1})))

      assert %{"error" => "document_not_verified", "reason" => "untrusted_certificate"} =
               conn |> post("/api/me/verification/nfc", body(foreign)) |> json_response(422)

      assert %{"error" => "document_not_verified", "reason" => "malformed_sod"} =
               conn
               |> post("/api/me/verification/nfc", %{body(doc) | "sod" => Base.encode64("nope")})
               |> json_response(422)
    end

    test "minors", %{conn: conn} = ctx do
      assert %{"error" => "underage"} =
               conn
               |> post("/api/me/verification/nfc", body(document(ctx, birth: ~D[2012-06-01])))
               |> json_response(422)
    end

    test "expired documents", %{conn: conn} = ctx do
      assert %{"error" => "document_expired"} =
               conn
               |> post("/api/me/verification/nfc", body(document(ctx, expiry: ~D[2021-03-01])))
               |> json_response(422)
    end

    test "a document already used by another account", %{conn: conn} = ctx do
      doc = document(ctx)
      assert conn |> post("/api/me/verification/nfc", body(doc)) |> json_response(200)

      assert %{"error" => "document_already_used"} =
               authed_conn_for_user(user_fixture())
               |> post("/api/me/verification/nfc", body(doc))
               |> json_response(409)
    end

    test "too many attempts", %{conn: conn} = ctx do
      bad = body(%{document(ctx) | dg2: PKI.dg2()})
      for _ <- 1..5, do: conn |> post("/api/me/verification/nfc", bad) |> json_response(422)

      response = conn |> post("/api/me/verification/nfc", bad)

      assert %{"error" => "too_many_attempts", "retryAfter" => retry} =
               json_response(response, 429)

      assert get_resp_header(response, "retry-after") == [Integer.to_string(retry)]
    end

    test "unavailable without a fingerprint key", %{conn: conn} = ctx do
      Application.put_env(:snack, :age_verification, fingerprint_key: nil)

      assert %{"error" => "age_verification_unavailable"} =
               conn |> post("/api/me/verification/nfc", body(document(ctx))) |> json_response(503)
    end

    test "the documents never appear in the request logs", %{conn: conn} = ctx do
      doc = document(ctx)
      encoded = body(doc)
      level = Logger.level()
      Logger.configure(level: :debug)
      on_exit(fn -> Logger.configure(level: level) end)

      log =
        capture_log([level: :debug], fn ->
          conn |> post("/api/me/verification/nfc", encoded) |> json_response(200)
        end)

      assert log =~ "[FILTERED]"

      for {_key, value} <- encoded do
        refute log =~ binary_part(value, 0, 24)
      end

      refute log =~ "PRUEBA"
    end
  end

  describe "AGE_VERIFICATION_REQUIRED" do
    setup %{user: user} do
      complete_profile_fixture(user)
      :ok
    end

    test "off by default: the social API does not ask for it", %{conn: conn} do
      refute conn |> get("/api/discovery/feed") |> Map.get(:status) == 403
    end

    test "on: social API blocked until verified; profile, safety and verification open",
         %{conn: conn, user: user} = ctx do
      Application.put_env(:snack, :features, age_verification_required: true)

      for path <- [
            "/api/discovery/feed",
            "/api/likes/received",
            "/api/matches",
            "/api/conversations"
          ] do
        assert %{"error" => "age_verification_required"} =
                 conn |> get(path) |> json_response(403),
               path
      end

      assert conn |> get("/api/me/profile") |> json_response(200)
      assert conn |> get("/api/bootstrap") |> json_response(200)
      assert %{"required" => true} = conn |> get("/api/me/verification") |> json_response(200)

      other = complete_profile_fixture(user_fixture())

      assert conn
             |> post("/api/users/#{other.id}/report", %{"reason" => "spam"})
             |> Map.get(:status) != 403

      assert conn |> post("/api/me/verification/nfc", body(document(ctx))) |> json_response(200)

      refute authed_conn_for_user(user) |> get("/api/discovery/feed") |> Map.get(:status) == 403
    end
  end
end
