defmodule Cherry.Identity.AgeVerificationsTest do
  use Cherry.DataCase, async: false

  import ExUnit.CaptureLog
  import Cherry.TestSupport.DatingFixtures

  alias Cherry.Identity.{AgeVerification, AgeVerificationAttempt, AgeVerifications}
  alias Cherry.Identity.Document.TrustStore
  alias Cherry.TestSupport.DiditStub
  alias Cherry.TestSupport.DocumentPKI, as: PKI

  @now ~U[2026-10-09 12:00:00Z]

  setup do
    previous = Application.get_env(:cherry, :age_verification)
    previous_didit = Application.get_env(:cherry, :didit)

    on_exit(fn ->
      Application.put_env(:cherry, :age_verification, previous)
      Application.put_env(:cherry, :didit, previous_didit)
    end)

    csca = PKI.csca()
    %{csca: csca, ds: PKI.document_signer(csca)}
  end

  defp document(ctx, opts \\ []) do
    PKI.document([csca: ctx.csca, ds: ctx.ds] ++ opts)
  end

  defp verify(user, doc, opts \\ []) do
    AgeVerifications.verify_nfc(
      user,
      Map.take(doc, [:dg1, :dg2, :sod]),
      Keyword.merge([now: @now, trust_anchors: doc.anchors], opts)
    )
  end

  defp attempts(user),
    do: Repo.aggregate(from(a in AgeVerificationAttempt, where: a.user_id == ^user.id), :count)

  defp hmac(input) do
    key = Application.get_env(:cherry, :age_verification)[:fingerprint_key]
    :crypto.mac(:hmac, :sha256, key, input)
  end

  describe "verify_nfc/3" do
    test "an adult's DNI stores only status, method, date and fingerprint", ctx do
      user = user_fixture()
      doc = document(ctx, personal_number: PKI.dni(12_345_678))

      assert {:ok, %AgeVerification{} = v} = verify(user, doc)
      assert v.status == "verified"
      assert v.method == "nfc_dni"
      assert v.verified_at == @now
      assert v.document_fingerprint == hmac("v1|ESP|ID|12345678Z")
      assert AgeVerifications.verified?(user.id)

      # The row has nothing else (no birth date, number, name or photo).
      assert [row] = Repo.query!("SELECT * FROM age_verifications").rows
      assert length(row) == 8
    end

    test "a passport uses the passport number", ctx do
      user = user_fixture()
      doc = document(ctx, format: :td3, document_number: "ZZ7654321")

      assert {:ok, %{method: "nfc_passport", document_fingerprint: fingerprint}} =
               verify(user, doc)

      assert fingerprint == hmac("v1|ESP|P|ZZ7654321")
    end

    test "a foreign card uses I as its code letter, whatever its MRZ says", ctx do
      for code <- ["ID", "AC", "C<"] do
        doc = document(ctx, state: "XXA", code: code, document_number: "ZZ1234567")

        assert {:ok, %{method: "nfc_dni", document_fingerprint: fingerprint}} =
                 verify(user_fixture(), doc)

        assert fingerprint == hmac("v1|XXA|I|ZZ1234567")
        Repo.delete_all(AgeVerification)
      end
    end

    test "minors are rejected and nothing about them is stored", ctx do
      user = user_fixture()
      doc = document(ctx, birth: ~D[2010-03-01])

      log = capture_log([level: :info], fn -> assert {:error, :underage} = verify(user, doc) end)

      refute AgeVerifications.verified?(user.id)
      assert Repo.aggregate(AgeVerification, :count) == 0
      refute log =~ user.id
      refute log =~ "underage"
    end

    test "expired documents are refused; documents without expiry are not", ctx do
      expired = document(ctx, format: :td3, expiry: ~D[2020-01-01])
      assert {:error, :document_expired} = verify(user_fixture(), expired)

      assert {:ok, _} = verify(user_fixture(), document(ctx, expiry: "<<<<<<"))

      assert {:ok, _} =
               verify(
                 user_fixture(),
                 document(ctx, expiry: ~D[2026-10-09], personal_number: PKI.dni(7))
               )
    end

    test "a minor's expired document is underage, not expired", ctx do
      doc = document(ctx, birth: ~D[2010-03-01], expiry: ~D[2020-01-01])
      assert {:error, :underage} = verify(user_fixture(), doc)

      # Old documents usually come with an expired Document Signer too.
      ds =
        PKI.document_signer(ctx.csca,
          not_before: DateTime.add(@now, -4000, :day),
          not_after: DateTime.add(@now, -1, :day)
        )

      old = PKI.document(csca: ctx.csca, ds: ds, birth: ~D[2010-03-01], expiry: ~D[2020-01-01])
      assert {:error, :underage} = verify(user_fixture(), old)

      user = user_fixture()
      adult = PKI.document(csca: ctx.csca, ds: ds)
      assert {:error, :certificate_expired} = verify(user, adult)
      refute AgeVerifications.verified?(user.id)

      # An adult's expired document with an expired signer: the document is what is said.
      old_adult = PKI.document(csca: ctx.csca, ds: ds, expiry: ~D[2020-01-01])
      assert {:error, :document_expired} = verify(user_fixture(), old_adult)
    end

    test "the 18th birthday counts from that day (UTC)", ctx do
      doc = document(ctx, birth: ~D[2008-10-09])

      assert {:error, :underage} = verify(user_fixture(), doc, now: ~U[2026-10-08 23:59:59Z])
      assert {:ok, _} = verify(user_fixture(), doc, now: ~U[2026-10-09 00:00:00Z])
    end

    test "the minimum age is configurable", ctx do
      Application.put_env(
        :cherry,
        :age_verification,
        Keyword.put(Application.get_env(:cherry, :age_verification), :minimum_age, 21)
      )

      assert AgeVerifications.minimum_age() == 21
      assert {:error, :underage} = verify(user_fixture(), document(ctx, birth: ~D[2006-01-01]))
      assert {:ok, _} = verify(user_fixture(), document(ctx, birth: ~D[2005-01-01]))
    end

    test "only the accepted kinds of document", ctx do
      Application.put_env(
        :cherry,
        :age_verification,
        Keyword.put(Application.get_env(:cherry, :age_verification), :accepted_documents, [
          :id_card
        ])
      )

      user = user_fixture()

      assert {:error, :unsupported_document} =
               verify(user, document(ctx, format: :td3, document_number: "ZZ7654321"))

      # A minor's genuine document is still a minor's, whatever its kind.
      assert {:error, :underage} =
               verify(user, document(ctx, format: :td3, birth: ~D[2010-03-01]))

      assert {:ok, %{method: "nfc_dni"}} = verify(user, document(ctx))
    end

    test "verifying again with the same document is idempotent", ctx do
      user = user_fixture()
      doc = document(ctx)

      assert {:ok, %{id: id}} = verify(user, doc)
      assert {:ok, %{id: ^id}} = verify(user, doc)
      assert Repo.aggregate(AgeVerification, :count) == 1
    end

    test "one document, one account", ctx do
      doc = document(ctx)

      assert {:ok, _} = verify(user_fixture(), doc)
      assert {:error, :document_already_used} = verify(user_fixture(), doc)
    end

    test "a renewed DNI of the same person is still the same person", ctx do
      first = document(ctx, document_number: "ZZZ000001", personal_number: PKI.dni(55_555_555))
      renewed = document(ctx, document_number: "ZZZ999999", personal_number: PKI.dni(55_555_555))

      assert {:ok, _} = verify(user_fixture(), first)
      assert {:error, :document_already_used} = verify(user_fixture(), renewed)
    end

    test "a verified user cannot switch to another document", ctx do
      user = user_fixture()

      assert {:ok, _} = verify(user, document(ctx, personal_number: PKI.dni(1)))

      assert {:error, :already_verified} =
               verify(user, document(ctx, personal_number: PKI.dni(2)))
    end

    test "a revoked verification is not replaced automatically", ctx do
      user = user_fixture()
      doc = document(ctx)
      {:ok, v} = verify(user, doc)
      Repo.update!(Ecto.Changeset.change(v, status: "revoked"))

      assert {:error, :verification_revoked} = verify(user, doc)
      refute AgeVerifications.verified?(user.id)
    end

    test "documents that fail passive authentication are rejected", ctx do
      user = user_fixture()
      doc = document(ctx)
      forged = %{doc | dg1: PKI.dg1(PKI.td1(birth: ~D[1980-01-01]))}

      assert {:error, :data_group_mismatch} = verify(user, forged)
      assert {:error, :untrusted_certificate} = verify(user, doc, trust_anchors: [])
      refute AgeVerifications.verified?(user.id)
    end

    test "without a fingerprint key verification is unavailable", ctx do
      user = user_fixture()
      Application.put_env(:cherry, :age_verification, fingerprint_key: nil)

      assert {:error, :unavailable} = verify(user, document(ctx))
      assert attempts(user) == 0
    end

    test "uses the configured CSCA trust store by default", ctx do
      previous = Application.get_env(:cherry, TrustStore)

      on_exit(fn ->
        Application.put_env(:cherry, TrustStore, previous)
        TrustStore.reload()
      end)

      Application.put_env(:cherry, TrustStore, paths: [], certificates: [ctx.csca.der])
      doc = document(ctx)

      assert {:ok, _} =
               AgeVerifications.verify_nfc(user_fixture(), Map.take(doc, [:dg1, :dg2, :sod]))
    end

    test "a crash never logs the document", _ctx do
      user = user_fixture()

      log =
        capture_log(fn ->
          assert {:error, :internal_error} =
                   AgeVerifications.verify_nfc(user, %{
                     dg1: {"SECRET-MARKER"},
                     dg2: "SECRET-MARKER",
                     sod: "SECRET-MARKER"
                   })
        end)

      assert log =~ "FunctionClauseError"
      refute log =~ "SECRET-MARKER"
    end
  end

  describe "development diagnostics" do
    test "log only public metadata of the signer certificate", ctx do
      Application.put_env(
        :cherry,
        :age_verification,
        Keyword.put(Application.get_env(:cherry, :age_verification), :diagnostics, true)
      )

      doc = document(ctx, document_number: "ZZZ424242", personal_number: PKI.dni(42_424_242))
      tampered = %{doc | dg2: PKI.dg2()}

      log =
        capture_log(fn ->
          assert {:error, :data_group_mismatch} = verify(user_fixture(), tampered)
        end)

      assert log =~ "diagnostics (data_group_mismatch)"
      assert log =~ "CN=ds test"
      assert log =~ "CN=csca test"
      assert log =~ "data_groups: [1, 2]"

      for secret <- [
            "ZZZ424242",
            "42424242",
            "PRUEBA",
            Base.encode16(:crypto.hash(:sha256, doc.dg1))
          ] do
        refute log =~ secret
      end
    end

    test "are off by default and skip errors that are not about the certificate", ctx do
      log = capture_log(fn -> verify(user_fixture(), %{document(ctx) | dg2: PKI.dg2()}) end)
      refute log =~ "diagnostics"

      Application.put_env(
        :cherry,
        :age_verification,
        Keyword.put(Application.get_env(:cherry, :age_verification), :diagnostics, true)
      )

      log = capture_log(fn -> verify(user_fixture(), document(ctx, birth: ~D[2015-01-01])) end)
      refute log =~ "diagnostics"
    end

    test "diagnose/1 describes unreadable SODs without echoing them" do
      assert %{error: :malformed_sod, size: 4, first_byte: 0x77} =
               Cherry.Identity.Document.PassiveAuth.diagnose(<<0x77, 2, 1, 2>>)
    end
  end

  describe "attempt limits" do
    test "5 per hour and 10 per day, also when they fail", ctx do
      user = user_fixture()
      bad = %{document(ctx) | dg2: PKI.dg2()}

      for _ <- 1..5, do: assert({:error, :data_group_mismatch} = verify(user, bad))

      assert {:error, {:too_many_attempts, retry}} = verify(user, bad)
      assert retry in 1..3600

      # An hour later the hourly window is free again.
      later = DateTime.add(@now, 3601, :second)
      for _ <- 1..5, do: assert({:error, :data_group_mismatch} = verify(user, bad, now: later))

      assert {:error, {:too_many_attempts, retry}} =
               verify(user, bad, now: DateTime.add(later, 3601, :second))

      assert retry > 3600

      # Blocked attempts are not counted, and other users are not affected.
      assert attempts(user) == 10
      assert {:ok, _} = verify(user_fixture(), document(ctx))
    end

    test "old attempts are pruned", ctx do
      user = user_fixture()
      bad = %{document(ctx) | dg2: PKI.dg2()}

      verify(user, bad, now: DateTime.add(@now, -2, :day))
      verify(user, bad)

      assert attempts(user) == 1
    end
  end

  describe "start_provider/3" do
    test "creates a Didit session for the user and counts an attempt" do
      user = user_fixture()
      DiditStub.stub()

      assert {:ok, %{session_id: id, url: "https://verify.didit.test/session/fake-token"}} =
               AgeVerifications.start_provider(user, "cherry://verify/selfie", now: @now)

      assert id == DiditStub.session_id()
      assert_receive {:didit, "POST", "/v3/session/", %{"vendor_data" => vendor_data}}
      assert vendor_data == user.id
      assert attempts(user) == 1
    end

    test "unavailable without Didit or without a fingerprint key" do
      user = user_fixture()
      DiditStub.stub()

      Application.put_env(
        :cherry,
        :didit,
        Keyword.put(Application.get_env(:cherry, :didit), :api_key, nil)
      )

      refute AgeVerifications.provider_available?()
      assert {:error, :unavailable} = AgeVerifications.start_provider(user, nil)

      Application.put_env(
        :cherry,
        :didit,
        Keyword.put(Application.get_env(:cherry, :didit), :api_key, "k")
      )

      Application.put_env(:cherry, :age_verification, fingerprint_key: nil)
      assert {:error, :unavailable} = AgeVerifications.start_provider(user, nil)

      assert attempts(user) == 0
      refute_receive {:didit, _, _, _}
    end

    test "a verified user does not start another verification", ctx do
      user = user_fixture()
      {:ok, _} = verify(user, document(ctx))
      DiditStub.stub()

      assert {:error, :already_verified} = AgeVerifications.start_provider(user, nil)
      refute_receive {:didit, _, _, _}
    end

    test "shares the attempt limits with NFC" do
      user = user_fixture()
      DiditStub.stub()

      for _ <- 1..5, do: assert({:ok, _} = AgeVerifications.start_provider(user, nil, now: @now))

      assert {:error, {:too_many_attempts, _}} =
               AgeVerifications.start_provider(user, nil, now: @now)
    end

    test "provider errors" do
      DiditStub.stub(create_status: 500)

      capture_log(fn ->
        assert {:error, :provider_error} = AgeVerifications.start_provider(user_fixture(), nil)
      end)
    end
  end

  describe "check_provider/3" do
    defp check(user, decision, opts \\ []) do
      DiditStub.stub(Keyword.put(opts, :decision, decision))
      AgeVerifications.check_provider(user, DiditStub.session_id(), now: @now)
    end

    defp assert_erased do
      path = "/v3/session/#{DiditStub.session_id()}/delete/"
      assert_receive {:didit, "DELETE", ^path, %{"deletion_instruction" => "privacy_erasure"}}
    end

    defp refute_erased, do: refute_receive({:didit, "DELETE", _, _})

    test "an approved adult's DNI is stored like NFC and erased at Didit" do
      user = user_fixture()
      level = Logger.level()
      Logger.configure(level: :info)
      on_exit(fn -> Logger.configure(level: level) end)

      log =
        capture_log([level: :info], fn ->
          assert {:ok, %AgeVerification{} = v} =
                   check(user, DiditStub.decision(user.id, "Approved"))

          assert v.status == "verified"
          assert v.method == "provider"
          assert v.verified_at == @now
          assert v.document_fingerprint == hmac("v1|ESP|ID|99999999R")
        end)

      assert AgeVerifications.verified?(user.id)
      assert_erased()
      assert attempts(user) == 0

      assert log =~ "age verification (provider): verified"

      for secret <- [user.id, DiditStub.session_id(), "99999999R", "ZZZ000001", "PRUEBA", "1990"] do
        refute log =~ secret
      end
    end

    test "the same DNI read by NFC is the same person (one document, one account)", ctx do
      assert {:ok, _} = verify(user_fixture(), document(ctx, personal_number: "99999999R"))

      user = user_fixture()

      # Didit may give the DNI as the document number and the card's number
      # elsewhere; formatting is ignored.
      decision =
        DiditStub.decision(user.id, "Approved", %{
          "document_number" => "99999999-r",
          "personal_number" => nil
        })

      assert {:error, :document_already_used} = check(user, decision)
      refute AgeVerifications.verified?(user.id)
      assert_erased()
    end

    test "a TIE uses the NIE and a passport its number, as with NFC", ctx do
      assert {:ok, _} =
               verify(user_fixture(), document(ctx, code: "IR", personal_number: "X0000000T"))

      user = user_fixture()

      tie =
        DiditStub.decision(user.id, "Approved", %{
          "document_type" => "Residence Permit",
          "document_number" => "E00000001",
          "personal_number" => "X0000000T"
        })

      assert {:error, :document_already_used} = check(user, tie)

      passport =
        DiditStub.decision(user.id, "APPROVED", %{
          "document_type" => "Passport",
          "document_number" => "ZZ7654321",
          "personal_number" => "99999999R"
        })

      assert {:ok, %{document_fingerprint: fingerprint}} = check(user, passport)
      assert fingerprint == hmac("v1|ESP|P|ZZ7654321")

      assert {:error, :document_already_used} =
               verify(user_fixture(), document(ctx, format: :td3, document_number: "ZZ7654321"))
    end

    test "other countries' identity cards use the document number" do
      user = user_fixture()

      decision =
        DiditStub.decision(user.id, "Approved", %{
          "issuing_state" => "PRT",
          "document_number" => "zz 123456",
          "personal_number" => "99999999R"
        })

      assert {:ok, %{document_fingerprint: fingerprint}} = check(user, decision)
      assert fingerprint == hmac("v1|PRT|I|ZZ123456")
    end

    test "a minor is underage, nothing is stored and the session is erased" do
      user = user_fixture()

      log =
        capture_log([level: :info], fn ->
          assert {:error, :underage} =
                   check(
                     user,
                     DiditStub.decision(user.id, "Approved", %{"date_of_birth" => "2010-03-01"})
                   )
        end)

      assert Repo.aggregate(AgeVerification, :count) == 0
      assert_erased()
      refute log =~ user.id
      refute log =~ "underage"
    end

    test "declined sessions are erased; a declined minor is underage" do
      user = user_fixture()

      assert {:error, :verification_declined} =
               check(user, DiditStub.decision(user.id, "Declined"))

      assert_erased()

      assert {:error, :verification_declined} =
               check(
                 user,
                 DiditStub.decision(user.id, "Declined", %{}, %{"id_verifications" => nil})
               )

      assert_erased()

      assert {:error, :underage} =
               check(
                 user,
                 DiditStub.decision(user.id, "Declined", %{"date_of_birth" => "2012-01-01"})
               )

      assert_erased()
      refute AgeVerifications.verified?(user.id)
    end

    test "unfinished and in-review sessions are pending and kept" do
      user = user_fixture()

      for status <- ["Not Started", "In Progress", "Awaiting User", "Resubmitted", "IN PROGRESS"] do
        decision = DiditStub.decision(user.id, status, %{}, %{"id_verifications" => nil})
        assert {:pending, :in_progress} = check(user, decision), status
      end

      assert {:pending, :in_review} = check(user, DiditStub.decision(user.id, "In Review"))
      refute_erased()
      refute AgeVerifications.verified?(user.id)
    end

    test "expired or abandoned sessions" do
      user = user_fixture()

      for status <- ["Expired", "Kyc Expired", "Abandoned"] do
        assert {:error, :session_expired} = check(user, DiditStub.decision(user.id, status))
        assert_erased()
      end
    end

    test "nobody can claim the session of another user" do
      user = user_fixture()
      other = user_fixture()

      assert {:error, :session_not_found} =
               check(user, DiditStub.decision(other.id, "Approved"))

      refute_erased()
      refute AgeVerifications.verified?(user.id)
      refute AgeVerifications.verified?(other.id)
    end

    test "unknown sessions" do
      user = user_fixture()
      assert {:error, :session_not_found} = check(user, :not_found)

      assert {:error, :session_not_found} =
               AgeVerifications.check_provider(user, "../other", now: @now)
    end

    test "expired documents are refused; documents without expiry are not" do
      user = user_fixture()

      assert {:error, :document_expired} =
               check(
                 user,
                 DiditStub.decision(user.id, "Approved", %{"expiration_date" => "2026-10-08"})
               )

      assert_erased()

      assert {:ok, _} =
               check(user, DiditStub.decision(user.id, "Approved", %{"expiration_date" => nil}))
    end

    test "documents other than identity cards, residence permits and passports" do
      user = user_fixture()

      decision =
        DiditStub.decision(user.id, "Approved", %{"document_type" => "Driver's License"})

      assert {:error, :unsupported_document} = check(user, decision)
      assert_erased()
    end

    test "documents the instance does not accept are unsupported, after the age check" do
      Application.put_env(
        :cherry,
        :age_verification,
        Keyword.put(Application.get_env(:cherry, :age_verification), :accepted_documents, [
          :passport
        ])
      )

      user = user_fixture()

      assert {:error, :unsupported_document} =
               check(user, DiditStub.decision(user.id, "Approved"))

      assert {:error, :underage} =
               check(
                 user,
                 DiditStub.decision(user.id, "Approved", %{"date_of_birth" => "2010-03-01"})
               )

      refute AgeVerifications.verified?(user.id)
    end

    test "an approved session without a birth date is declined" do
      user = user_fixture()

      assert {:error, :verification_declined} =
               check(user, DiditStub.decision(user.id, "Approved", %{"date_of_birth" => nil}))
    end

    test "a failed erasure does not undo the verification" do
      user = user_fixture()

      log =
        capture_log(fn ->
          assert {:ok, _} =
                   check(user, DiditStub.decision(user.id, "Approved"), delete_status: 503)
        end)

      assert AgeVerifications.verified?(user.id)
      assert log =~ "session erasure failed (503)"
      refute log =~ DiditStub.session_id()
    end

    test "sandbox decisions are refused unless allowed" do
      user = user_fixture()

      Application.put_env(
        :cherry,
        :didit,
        Keyword.put(Application.get_env(:cherry, :didit), :allow_sandbox, false)
      )

      capture_log(fn ->
        assert {:error, :provider_error} = check(user, DiditStub.decision(user.id, "Approved"))
      end)

      refute AgeVerifications.verified?(user.id)

      live = DiditStub.decision(user.id, "Approved", %{}, %{"environment" => "live"})
      assert {:ok, _} = check(user, live)
    end

    test "a verified user checking the same document again is idempotent" do
      user = user_fixture()
      assert {:ok, %{id: id}} = check(user, DiditStub.decision(user.id, "Approved"))
      assert {:ok, %{id: ^id}} = check(user, DiditStub.decision(user.id, "Approved"))
    end
  end
end
