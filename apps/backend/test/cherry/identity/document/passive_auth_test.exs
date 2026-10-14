defmodule Cherry.Identity.Document.PassiveAuthTest do
  use ExUnit.Case, async: true

  alias Cherry.Identity.Document.{Certificate, PassiveAuth}
  alias Cherry.TestSupport.DocumentPKI, as: PKI

  @fixtures Path.expand("../../../fixtures/document", __DIR__)

  defp verify(doc, opts \\ []) do
    PassiveAuth.verify(
      %{dg1: doc.dg1, dg2: doc.dg2, sod: doc.sod},
      Keyword.put_new(opts, :trust_anchors, doc.anchors)
    )
  end

  defp anchor(%{der: der}) do
    {:ok, cert} = Certificate.parse(der)
    cert
  end

  defp flip_last_byte(bin) do
    size = byte_size(bin) - 1
    <<head::binary-size(size), last>> = bin
    head <> <<Bitwise.bxor(last, 1)>>
  end

  describe "valid documents" do
    test "Spanish DNI (TD1) signed with RSA PKCS#1 v1.5" do
      doc = PKI.document(personal_number: PKI.dni(12_345_678), birth: ~D[1990-05-17])

      assert {:ok, %{mrz: mrz, document_signer: ds, csca: csca}} = verify(doc)
      assert mrz.format == :td1
      assert mrz.issuing_state == "ESP"
      assert mrz.document_number == "ZZZ000001"
      assert mrz.personal_number == "12345678Z"
      assert mrz.birth_date == ~D[1990-05-17]
      assert ds.der == doc.ds.der
      assert csca.der == doc.csca.der
    end

    test "passport (TD3)" do
      doc = PKI.document(format: :td3, state: "XXA", document_number: "ZZ1234567")

      assert {:ok, %{mrz: mrz}} = verify(doc)
      assert mrz.format == :td3
      assert mrz.document_number == "ZZ1234567"
      assert mrz.personal_number == nil
    end

    test "passports never expose a personal number (it may be a parent's DNI)" do
      doc = PKI.document(format: :td3, personal_number: PKI.dni(87_654_321))
      assert {:ok, %{mrz: %{personal_number: nil, document_number: "ZZ0000001"}}} = verify(doc)
    end

    test "RSASSA-PSS SignerInfo and PSS-signed Document Signer certificate" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca, scheme: {:rsa_pss, :sha256, 32})
      doc = PKI.document(csca: csca, ds: ds, scheme: {:rsa_pss, :sha256, 32})

      assert {:ok, _} = verify(doc)
    end

    test "ECDSA over secp256r1 (named curve)" do
      csca = PKI.csca(key: PKI.key({:ec, :secp256r1}))
      ds = PKI.document_signer(csca, key: PKI.key({:ec, :secp256r1}))

      assert {:ok, _} = verify(PKI.document(csca: csca, ds: ds))
    end

    test "ECDSA over brainpoolP256r1 with explicit domain parameters" do
      csca = PKI.csca(key: PKI.key({:ec, :brainpoolP256r1}), explicit_params: true)

      ds =
        PKI.document_signer(csca, key: PKI.key({:ec, :brainpoolP256r1}), explicit_params: true)

      assert {:ok, _} = verify(PKI.document(csca: csca, ds: ds))
    end

    test "BSI plain ECDSA signature (r‖s) over brainpoolP384r1" do
      csca = PKI.csca(key: PKI.key({:ec, :brainpoolP384r1}))
      ds = PKI.document_signer(csca, key: PKI.key({:ec, :brainpoolP384r1}))
      doc = PKI.document(csca: csca, ds: ds, scheme: {:ecdsa_plain, :sha384}, digest: :sha384)

      assert {:ok, _} = verify(doc)
    end

    test "other LDS digests, signer identified by key identifier, no signed attributes" do
      for opts <- [
            [digest: :sha],
            [digest: :sha512, scheme: {:rsa_pkcs1, :sha512}],
            [digest: :sha256, signer_digest: :sha384, scheme: {:rsa_pkcs1, :sha384}],
            [sid: :ski],
            [signed_attrs: false]
          ] do
        assert {:ok, _} = verify(PKI.document(opts)), "failed with #{inspect(opts)}"
      end
    end

    test "SOD signed by OpenSSL with RSASSA-PSS and extra signed attributes" do
      assert {:ok, %{mrz: mrz}} = verify_fixture("sod_rsa_pss.der", "csca_rsa.pem")
      assert mrz.personal_number == "12345678Z"
      assert mrz.birth_date == ~D[1990-05-17]
    end

    test "SOD signed by OpenSSL with ECDSA, explicit parameters and SKI signer id" do
      assert {:ok, %{mrz: %{document_number: "ZZZ000002"}}} =
               verify_fixture("sod_ec_explicit.der", "csca_ec.pem")
    end

    test "a CSCA with the same name but another key is skipped in favour of the right one" do
      csca = PKI.csca()
      impostor = PKI.csca(key: PKI.key({:ec, :secp256r1}))
      doc = PKI.document(csca: csca)

      assert {:ok, _} = verify(doc, trust_anchors: [anchor(impostor) | doc.anchors])
    end
  end

  defp verify_fixture(sod, csca) do
    [anchor] = Cherry.Identity.Document.TrustStore.read_file(Path.join(@fixtures, csca))
    {:ok, anchor} = Certificate.parse(anchor)

    PassiveAuth.verify(
      %{
        dg1: File.read!(Path.join(@fixtures, "dg1.der")),
        dg2: File.read!(Path.join(@fixtures, "dg2.der")),
        sod: File.read!(Path.join(@fixtures, sod))
      },
      trust_anchors: [anchor]
    )
  end

  describe "signature" do
    test "an altered signature is rejected" do
      assert {:error, :invalid_signature} = verify(PKI.document(tamper: :signature))
    end

    test "a message digest that does not match the content is rejected" do
      assert {:error, :invalid_signature} = verify(PKI.document(tamper: :message_digest))
    end

    test "a signed content type that does not match the content is rejected" do
      assert {:error, :invalid_signature} = verify(PKI.document(tamper: :content_type))
    end

    test "a SOD signed by a key that is not the certificate's is rejected" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca)
      other = %{ds | key: PKI.key(:rsa, :other)}
      doc = PKI.document(csca: csca, ds: ds)
      forged = PKI.sod(%{1 => doc.dg1, 2 => doc.dg2}, other)

      assert {:error, :invalid_signature} = verify(%{doc | sod: forged})
    end

    test "without the Document Signer certificate in the SOD" do
      assert {:error, :missing_document_signer} =
               verify(PKI.document(include_certificate: false))
    end
  end

  describe "data groups" do
    test "an altered DG1 is rejected (e.g. a changed birth date)" do
      doc = PKI.document(birth: ~D[2012-01-01])
      adult = PKI.dg1(PKI.td1(birth: ~D[1990-01-01]))

      assert {:error, :data_group_mismatch} = verify(%{doc | dg1: adult})
    end

    test "an altered DG2 is rejected" do
      doc = PKI.document()
      assert {:error, :data_group_mismatch} = verify(%{doc | dg2: flip_last_byte(doc.dg2)})
    end

    test "a data group the SOD does not sign is rejected" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca)
      dg1 = PKI.dg1(PKI.td1())
      sod = PKI.sod(%{1 => dg1}, ds)
      doc = %{dg1: dg1, dg2: PKI.dg2(), sod: sod, anchors: [anchor(csca)]}

      assert {:error, :data_group_mismatch} = verify(doc)
    end

    test "a signed DG1 with a wrong check digit is rejected" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca)
      <<head::binary-14, digit, rest::binary>> = PKI.td1()
      bad = head <> <<if(digit == ?9, do: ?0, else: digit + 1)>> <> rest
      dg1 = PKI.dg1(bad)
      dg2 = PKI.dg2()

      doc = %{
        dg1: dg1,
        dg2: dg2,
        sod: PKI.sod(%{1 => dg1, 2 => dg2}, ds),
        anchors: [anchor(csca)]
      }

      assert {:error, :invalid_check_digit} = verify(doc)
    end
  end

  describe "certificate chain" do
    test "a Document Signer from a CSCA we do not trust" do
      doc = PKI.document()
      other = PKI.csca(cn: "CSCA OTHER", key: PKI.key({:ec, :secp256r1}))

      assert {:error, :untrusted_certificate} = verify(doc, trust_anchors: [anchor(other)])
      assert {:error, :untrusted_certificate} = verify(doc, trust_anchors: [])
    end

    test "a Document Signer self-issued with the CSCA's name (broken chain)" do
      csca = PKI.csca()
      fake_issuer = %{csca | key: PKI.key(:rsa, :attacker)}
      ds = PKI.document_signer(fake_issuer)

      assert {:error, :untrusted_certificate} = verify(PKI.document(csca: csca, ds: ds))
    end

    test "an expired Document Signer certificate" do
      csca = PKI.csca()
      past = DateTime.add(DateTime.utc_now(), -1, :day) |> DateTime.truncate(:second)
      ds = PKI.document_signer(csca, not_before: DateTime.add(past, -400, :day), not_after: past)

      assert {:error, :certificate_expired} = verify(PKI.document(csca: csca, ds: ds))
    end

    test "an expired certificate is only reported when allowed" do
      csca = PKI.csca()
      past = DateTime.add(DateTime.utc_now(), -1, :day) |> DateTime.truncate(:second)
      ds = PKI.document_signer(csca, not_before: DateTime.add(past, -400, :day), not_after: past)
      doc = PKI.document(csca: csca, ds: ds)

      assert {:ok, %{certificate_expired: true, mrz: %{}}} =
               verify(doc, allow_expired_certificates: true)

      assert {:ok, %{certificate_expired: false}} =
               verify(PKI.document(csca: csca), allow_expired_certificates: true)

      # The signatures are still checked.
      tampered = %{doc | dg1: PKI.document(csca: csca, ds: ds, birth: ~D[1985-02-02]).dg1}

      assert {:error, :data_group_mismatch} =
               verify(tampered, allow_expired_certificates: true)
    end

    test "a Document Signer certificate that is not valid yet" do
      csca = PKI.csca()
      future = DateTime.add(DateTime.utc_now(), 2, :day) |> DateTime.truncate(:second)
      ds = PKI.document_signer(csca, not_before: future)

      assert {:error, :certificate_expired} = verify(PKI.document(csca: csca, ds: ds))
    end

    test "an expired CSCA" do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      csca =
        PKI.csca(
          not_before: DateTime.add(now, -4000, :day),
          not_after: DateTime.add(now, -1, :day)
        )

      assert {:error, :certificate_expired} = verify(PKI.document(csca: csca))
    end

    test "the validity is checked at the given time" do
      doc = PKI.document()
      later = DateTime.add(DateTime.utc_now(), 20 * 365, :day)

      assert {:error, :certificate_expired} = verify(doc, now: later)
    end

    test "a Document Signer with an unknown critical extension" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca, extra_extensions: [{"1.2.3.4.5", true, PKI.null()}])

      assert {:error, :untrusted_certificate} = verify(PKI.document(csca: csca, ds: ds))
    end

    test "ICAO's document type list extension is accepted even when critical" do
      csca = PKI.csca()

      ds =
        PKI.document_signer(csca,
          extra_extensions: [{"2.23.136.1.1.6.2", true, PKI.seq([PKI.int(0)])}]
        )

      assert {:ok, _} = verify(PKI.document(csca: csca, ds: ds))
    end

    test "a Document Signer that is a CA or cannot sign" do
      csca = PKI.csca()

      for opts <- [[ca: true], [key_usage: :ca]] do
        ds = PKI.document_signer(csca, opts)

        assert {:error, :untrusted_certificate} = verify(PKI.document(csca: csca, ds: ds)),
               "accepted #{inspect(opts)}"
      end
    end

    test "a trust anchor that may not sign certificates" do
      csca = PKI.csca(key_usage: :signer)
      assert {:error, :untrusted_certificate} = verify(PKI.document(csca: csca))
    end

    test "authority key identifier must match the CSCA's when both are present" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca, aki: :crypto.strong_rand_bytes(20))

      assert {:error, :untrusted_certificate} = verify(PKI.document(csca: csca, ds: ds))
    end
  end

  describe "malformed input" do
    test "garbage, truncated or empty SODs" do
      doc = PKI.document()
      truncated = binary_part(doc.sod, 0, byte_size(doc.sod) - 10)

      for sod <- ["", <<0x77, 0x00>>, :crypto.strong_rand_bytes(300), truncated, doc.dg1] do
        assert {:error, :malformed_sod} = verify(%{doc | sod: sod})
      end
    end

    test "SODs with many signers or certificates are refused before any signature check" do
      doc = PKI.document()
      {:ok, {_, ci_value, _}} = Cherry.Identity.Document.Der.decode(doc.sod)
      {:ok, content_info} = Cherry.Identity.Document.Der.decode(ci_value)
      {:ok, [type, {_, explicit, _}]} = Cherry.Identity.Document.Der.children(content_info)
      {:ok, signed_data} = Cherry.Identity.Document.Der.decode(explicit)

      {:ok, [v, d, e, {_, certs, _}, {_, signers, _}]} =
        Cherry.Identity.Document.Der.children(signed_data)

      raws = fn list -> Enum.map(list, &elem(&1, 2)) end
      {:ok, [cert]} = Cherry.Identity.Document.Der.children(certs)
      {:ok, [signer]} = Cherry.Identity.Document.Der.children(signers)

      rebuild = fn certificates, signer_infos ->
        sd =
          PKI.seq(
            raws.([v, d, e]) ++
              [PKI.implicit(0, Enum.join(certificates)), PKI.tlv(0x31, Enum.join(signer_infos))]
          )

        PKI.tlv(0x77, PKI.seq([elem(type, 2), PKI.explicit(0, sd)]))
      end

      cert = elem(cert, 2)
      signer = elem(signer, 2)
      assert {:ok, _} = verify(%{doc | sod: rebuild.([cert], [signer, signer])})

      assert {:error, :malformed_sod} =
               verify(%{doc | sod: rebuild.([cert], [signer, signer, signer])})

      assert {:error, :malformed_sod} =
               verify(%{doc | sod: rebuild.(List.duplicate(cert, 5), [signer])})
    end

    test "a SOD whose content is not an LDSSecurityObject" do
      assert {:error, :malformed_sod} = verify(PKI.document(content_type: "1.2.840.113549.1.7.1"))
    end

    test "a malformed DG1" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca)
      dg1 = PKI.tlv(0x61, PKI.tlv(<<0x5F, 0x1F>>, "NOT A MRZ"))
      dg2 = PKI.dg2()

      doc = %{
        dg1: dg1,
        dg2: dg2,
        sod: PKI.sod(%{1 => dg1, 2 => dg2}, ds),
        anchors: [anchor(csca)]
      }

      assert {:error, :malformed_dg1} = verify(doc)
    end
  end
end
