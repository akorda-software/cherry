defmodule Cherry.Identity.AgeVerificationsTest do
  use Cherry.DataCase, async: false

  import ExUnit.CaptureLog
  import Cherry.TestSupport.DatingFixtures

  alias Cherry.Identity.{AgeVerification, AgeVerificationAttempt, AgeVerifications}
  alias Cherry.Identity.Document.TrustStore
  alias Cherry.TestSupport.DocumentPKI, as: PKI

  @now ~U[2026-10-09 12:00:00Z]

  setup do
    previous = Application.get_env(:cherry, :age_verification)
    on_exit(fn -> Application.put_env(:cherry, :age_verification, previous) end)

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

    test "the 18th birthday counts from that day (UTC)", ctx do
      doc = document(ctx, birth: ~D[2008-10-09])

      assert {:error, :underage} = verify(user_fixture(), doc, now: ~U[2026-10-08 23:59:59Z])
      assert {:ok, _} = verify(user_fixture(), doc, now: ~U[2026-10-09 00:00:00Z])
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
end
