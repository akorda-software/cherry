defmodule CherryWeb.Controllers.Api.AgeVerificationControllerTest do
  use CherryWeb.ConnCase, async: false

  import Ecto.Query
  import ExUnit.CaptureLog
  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Cherry.Accounts.User
  alias Cherry.Dating
  alias Cherry.Dating.{Match, Profile, ProfilePhoto}
  alias Cherry.Identity.{AgeVerification, AgeVerificationAttempt}
  alias Cherry.Identity.Document.TrustStore
  alias Cherry.Repo
  alias Cherry.TestSupport.DiditStub
  alias Cherry.TestSupport.DocumentPKI, as: PKI

  setup do
    previous = %{
      store: Application.get_env(:cherry, TrustStore),
      age: Application.get_env(:cherry, :age_verification),
      didit: Application.get_env(:cherry, :didit),
      features: Application.get_env(:cherry, :features)
    }

    on_exit(fn ->
      Application.put_env(:cherry, TrustStore, previous.store)
      Application.put_env(:cherry, :age_verification, previous.age)
      Application.put_env(:cherry, :didit, previous.didit)

      if previous.features,
        do: Application.put_env(:cherry, :features, previous.features),
        else: Application.delete_env(:cherry, :features)

      TrustStore.reload()
    end)

    csca = PKI.csca()
    Application.put_env(:cherry, TrustStore, paths: [], certificates: [csca.der])
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
               "required" => false,
               "providerAvailable" => true
             } = conn |> get("/api/me/verification") |> json_response(200)
    end

    test "providerAvailable needs Didit and the fingerprint key", %{conn: conn} do
      assert %{"ageVerification" => %{"providerAvailable" => true}} =
               conn |> get("/api/bootstrap") |> json_response(200)

      Application.put_env(:cherry, :didit, workflow_id: nil)

      assert %{"providerAvailable" => false} =
               conn |> get("/api/me/verification") |> json_response(200)

      assert %{"ageVerification" => %{"providerAvailable" => false}} =
               conn |> get("/api/bootstrap") |> json_response(200)
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

    test "a minor's account is erased entirely", %{conn: conn, user: user} = ctx do
      profile = complete_profile_fixture(user)
      other = complete_profile_fixture(user_fixture())
      mutual_match!(profile, other)

      assert %{"error" => "underage", "accountDeleted" => true} =
               conn
               |> post("/api/me/verification/nfc", body(document(ctx, birth: ~D[2012-06-01])))
               |> json_response(422)

      refute Repo.get(User, user.id)
      refute Repo.get(Profile, profile.id)

      for schema <- [Match, AgeVerification, AgeVerificationAttempt] do
        assert Repo.aggregate(schema, :count) == 0, inspect(schema)
      end

      photos = fn id ->
        Repo.aggregate(from(p in ProfilePhoto, where: p.profile_id == ^id), :count)
      end

      assert photos.(profile.id) == 0
      assert photos.(other.id) == 2

      # The session is gone with the account.
      assert conn |> get("/api/bootstrap") |> json_response(401)
      assert Repo.get(Profile, other.id)
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
      Application.put_env(:cherry, :age_verification, fingerprint_key: nil)

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
      Application.put_env(:cherry, :features, age_verification_required: true)

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

  describe "pending verification (AGE_VERIFICATION_REQUIRED on)" do
    setup %{user: user} = ctx do
      Application.put_env(:cherry, :features, age_verification_required: true)
      viewer = complete_profile_fixture(user)
      refute viewer.is_discoverable

      assert ctx.conn
             |> post("/api/me/verification/nfc", body(document(ctx, personal_number: PKI.dni(1))))
             |> json_response(200)

      %{viewer: Repo.get!(Profile, viewer.id)}
    end

    defp verify!(ctx, user, n) do
      assert authed_conn_for_user(user)
             |> post("/api/me/verification/nfc", body(document(ctx, personal_number: PKI.dni(n))))
             |> json_response(200)
    end

    defp feed_ids(conn) do
      conn
      |> get("/api/discovery/feed")
      |> json_response(200)
      |> Map.fetch!("profiles")
      |> Enum.map(& &1["id"])
    end

    defp liker_ids(conn) do
      conn
      |> get("/api/likes/received")
      |> json_response(200)
      |> Map.fetch!("likes")
      |> Enum.map(& &1["profile"]["id"])
    end

    test "verifying makes the profile discoverable", %{viewer: viewer} do
      assert viewer.is_discoverable
      refute viewer.is_paused
    end

    test "an unverified profile is invisible until verified, then visible", ctx do
      other_user = user_fixture()
      other = complete_profile_fixture(other_user)
      like!(other, ctx.viewer)

      refute other.is_discoverable
      refute other.is_paused

      assert %{
               "profile" => %{
                 "isComplete" => true,
                 "isDiscoverable" => false,
                 "isPaused" => false
               },
               "ageVerification" => %{"required" => true, "status" => "unverified"}
             } = authed_conn_for_user(other_user) |> get("/api/bootstrap") |> json_response(200)

      refute other.id in feed_ids(ctx.conn)
      refute other.id in liker_ids(ctx.conn)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> get("/api/profiles/#{other.id}") |> json_response(404)

      # Editing the profile keeps it pending.
      assert authed_conn_for_user(other_user)
             |> put("/api/me/profile", %{"bio" => "Una bio nueva y suficientemente larga."})
             |> json_response(200)

      refute Repo.get!(Profile, other.id).is_discoverable

      verify!(ctx, other_user, 2)

      assert Repo.get!(Profile, other.id).is_discoverable
      assert other.id in feed_ids(ctx.conn)
      assert other.id in liker_ids(ctx.conn)
      assert ctx.conn |> get("/api/profiles/#{other.id}") |> json_response(200)

      assert %{
               "profile" => %{"isDiscoverable" => true},
               "ageVerification" => %{"required" => true, "status" => "verified"}
             } = authed_conn_for_user(other_user) |> get("/api/bootstrap") |> json_response(200)
    end

    test "verifying respects a pause by the owner", ctx do
      other_user = user_fixture()
      other = complete_profile_fixture(other_user)
      {:ok, _} = Dating.pause_profile(other)

      verify!(ctx, other_user, 3)

      paused = Repo.get!(Profile, other.id)
      assert paused.is_paused
      refute paused.is_discoverable
      refute other.id in feed_ids(ctx.conn)

      assert %{"ok" => true} =
               authed_conn_for_user(other_user) |> post("/api/me/unpause") |> json_response(200)

      assert Repo.get!(Profile, other.id).is_discoverable
      assert other.id in feed_ids(ctx.conn)
    end

    test "unpausing does not skip the verification", ctx do
      other_user = user_fixture()
      other = complete_profile_fixture(other_user)
      {:ok, _} = Dating.pause_profile(other)

      assert %{"ok" => true} =
               authed_conn_for_user(other_user) |> post("/api/me/unpause") |> json_response(200)

      resumed = Repo.get!(Profile, other.id)
      refute resumed.is_paused
      refute resumed.is_discoverable
      refute other.id in feed_ids(ctx.conn)
    end
  end

  describe "AGE_VERIFICATION_REQUIRED off" do
    test "unverified profiles stay discoverable and visible", %{user: user, conn: conn} do
      viewer = complete_profile_fixture(user)
      other = complete_profile_fixture(user_fixture())
      like!(other, viewer)

      assert viewer.is_discoverable
      assert other.is_discoverable

      assert %{"profiles" => profiles} = conn |> get("/api/discovery/feed") |> json_response(200)
      assert other.id in Enum.map(profiles, & &1["id"])

      assert %{"likes" => [%{"profile" => %{"id" => id}}]} =
               conn |> get("/api/likes/received") |> json_response(200)

      assert id == other.id
    end
  end

  describe "POST /api/me/verification/provider" do
    test "starts a Didit session for the user", %{conn: conn, user: user} do
      DiditStub.stub()

      assert %{"sessionId" => id, "url" => "https://verify.didit.test/session/fake-token"} =
               conn
               |> post("/api/me/verification/provider", %{"callback" => "cherry://verify/selfie"})
               |> json_response(201)

      assert id == DiditStub.session_id()

      assert_receive {:didit, "POST", "/v3/session/",
                      %{"vendor_data" => vendor_data, "callback" => "cherry://verify/selfie"}}

      assert vendor_data == user.id
    end

    test "the callback is optional and may be https", %{conn: conn} do
      DiditStub.stub()
      assert conn |> post("/api/me/verification/provider", %{}) |> json_response(201)

      assert conn
             |> post("/api/me/verification/provider", %{"callback" => "https://cherry.test/v"})
             |> json_response(201)
    end

    test "invalid callbacks", %{conn: conn} do
      DiditStub.stub()

      for callback <- [
            "http://cherry.test/v",
            "javascript://alert(1)",
            "file:///etc/passwd",
            "cherry:verify",
            "no scheme",
            "cherry://with space",
            "Cherry://upper",
            "cherry://" <> String.duplicate("a", 200),
            42
          ] do
        assert %{"error" => "invalid_payload"} =
                 conn
                 |> post("/api/me/verification/provider", %{"callback" => callback})
                 |> json_response(422),
               inspect(callback)
      end

      refute_receive {:didit, _, _, _}
    end

    test "unavailable without Didit", %{conn: conn} do
      Application.put_env(:cherry, :didit, api_key: nil)

      assert %{"error" => "age_verification_unavailable"} =
               conn |> post("/api/me/verification/provider", %{}) |> json_response(503)
    end

    test "already verified", %{conn: conn} = ctx do
      assert conn |> post("/api/me/verification/nfc", body(document(ctx))) |> json_response(200)

      assert %{"error" => "already_verified"} =
               conn |> post("/api/me/verification/provider", %{}) |> json_response(409)
    end

    test "too many attempts", %{conn: conn} do
      DiditStub.stub()
      for _ <- 1..5, do: conn |> post("/api/me/verification/provider", %{}) |> json_response(201)

      assert %{"error" => "too_many_attempts", "retryAfter" => _} =
               conn |> post("/api/me/verification/provider", %{}) |> json_response(429)
    end

    test "provider errors", %{conn: conn} do
      DiditStub.stub(create_status: 401)

      capture_log(fn ->
        assert %{"error" => "provider_error"} =
                 conn |> post("/api/me/verification/provider", %{}) |> json_response(502)
      end)
    end
  end

  describe "POST /api/me/verification/provider/check" do
    defp check(conn, decision, opts \\ []) do
      DiditStub.stub(Keyword.put(opts, :decision, decision))

      post(conn, "/api/me/verification/provider/check", %{"sessionId" => DiditStub.session_id()})
    end

    test "verified", %{conn: conn, user: user} do
      assert %{
               "result" => "verified",
               "verification" => %{
                 "status" => "verified",
                 "method" => "provider",
                 "verifiedAt" => at
               },
               "required" => false
             } = conn |> check(DiditStub.decision(user.id, "Approved")) |> json_response(200)

      assert {:ok, _, _} = DateTime.from_iso8601(at)

      path = "/v3/session/#{DiditStub.session_id()}/delete/"
      assert_receive {:didit, "DELETE", ^path, _}

      assert %{"ageVerification" => %{"status" => "verified"}} =
               authed_conn_for_user(user) |> get("/api/bootstrap") |> json_response(200)
    end

    test "pending and in review", %{conn: conn, user: user} do
      assert %{"result" => "pending"} =
               conn |> check(DiditStub.decision(user.id, "In Progress")) |> json_response(200)

      assert %{"result" => "in_review"} =
               conn |> check(DiditStub.decision(user.id, "In Review")) |> json_response(200)
    end

    test "invalid session ids", %{conn: conn} do
      DiditStub.stub()

      for body <- [%{}, %{"sessionId" => "nope"}, %{"sessionId" => 1}] do
        assert %{"error" => "invalid_payload"} =
                 conn
                 |> post("/api/me/verification/provider/check", body)
                 |> json_response(422)
      end

      refute_receive {:didit, _, _, _}
    end

    test "a minor's account is erased entirely", %{conn: conn, user: user} do
      profile = complete_profile_fixture(user)

      decision = DiditStub.decision(user.id, "Approved", %{"date_of_birth" => "2012-06-01"})

      assert %{"error" => "underage", "accountDeleted" => true} =
               conn |> check(decision) |> json_response(422)

      refute Repo.get(User, user.id)
      refute Repo.get(Profile, profile.id)
      assert Repo.aggregate(AgeVerificationAttempt, :count) == 0
      assert conn |> get("/api/bootstrap") |> json_response(401)
    end

    test "rejections", %{conn: conn, user: user} do
      for {decision, status, code} <- [
            {DiditStub.decision(user.id, "Declined"), 422, "verification_declined"},
            {DiditStub.decision(user.id, "Expired"), 422, "session_expired"},
            {DiditStub.decision(user.id, "Approved", %{"document_type" => "Driver's License"}),
             422, "unsupported_document"},
            {DiditStub.decision(user.id, "Approved", %{"expiration_date" => "2020-01-01"}), 422,
             "document_expired"},
            {DiditStub.decision(user_fixture().id, "Approved"), 404, "session_not_found"},
            {:not_found, 404, "session_not_found"}
          ] do
        assert %{"error" => ^code} = conn |> check(decision) |> json_response(status)
      end

      capture_log(fn ->
        assert %{"error" => "provider_error"} =
                 conn |> check({:status, 500}) |> json_response(502)
      end)

      assert %{"verification" => %{"status" => "unverified"}} =
               conn |> get("/api/me/verification") |> json_response(200)
    end

    test "a document already used with NFC by another account", %{conn: conn, user: user} = ctx do
      assert authed_conn_for_user(user_fixture())
             |> post(
               "/api/me/verification/nfc",
               body(document(ctx, personal_number: "99999999R"))
             )
             |> json_response(200)

      assert %{"error" => "document_already_used"} =
               conn |> check(DiditStub.decision(user.id, "Approved")) |> json_response(409)
    end

    test "a revoked verification", %{conn: conn, user: user} = ctx do
      assert conn |> post("/api/me/verification/nfc", body(document(ctx))) |> json_response(200)

      Repo.update_all(from(v in AgeVerification, where: v.user_id == ^user.id),
        set: [status: "revoked"]
      )

      assert %{"error" => "verification_revoked"} =
               conn |> check(DiditStub.decision(user.id, "Approved")) |> json_response(403)
    end
  end
end
