defmodule Cherry.Identity.Document.CertificateTest do
  use ExUnit.Case, async: true

  alias Cherry.Identity.Document.{Certificate, Der, Signature}
  alias Cherry.TestSupport.DocumentPKI, as: PKI

  @csca_dir Path.expand("../../../../priv/csca", __DIR__)

  describe "parse/1" do
    test "reads the fields passive authentication needs" do
      csca = PKI.csca()
      ds = PKI.document_signer(csca, serial: 4242)
      {:ok, cert} = Certificate.parse(ds.der)

      assert cert.serial == 4242
      assert cert.ca? == nil
      assert cert.key_usage == [:digital_signature]
      assert cert.subject_key_id == ds.ski
      assert cert.authority_key_id == csca.ski
      assert {:rsa, _n, <<1, 0, 1>>} = cert.public_key
      assert Certificate.signed_by?(cert, elem(Certificate.parse(csca.der), 1))

      assert Certificate.fingerprint(cert) ==
               Base.encode16(:crypto.hash(:sha256, ds.der), case: :lower)
    end

    test "dates far in the future use GeneralizedTime" do
      csca = PKI.csca(not_after: ~U[2126-01-01 00:00:00Z])
      assert {:ok, %{not_after: ~U[2126-01-01 00:00:00Z]}} = Certificate.parse(csca.der)
    end

    test "unsupported key types parse but never verify" do
      {:ok, cert} = Certificate.parse(PKI.csca().der)
      ed25519 = %{cert | public_key: :unsupported}
      refute Certificate.signed_by?(cert, ed25519)
    end

    test "garbage" do
      for bad <- ["", "nope", PKI.seq([PKI.int(1)]), <<0x30, 0x03, 0x02, 0x01>>, 42] do
        assert {:error, :malformed_certificate} = Certificate.parse(bad)
      end
    end

    test "the Spanish CSCAs shipped in priv/csca (RSA-4096, self-signed)" do
      for file <- Cherry.Identity.Document.TrustStore.files(@csca_dir),
          der <- Cherry.Identity.Document.TrustStore.read_file(file) do
        assert {:ok, cert} = Certificate.parse(der), file
        assert cert.ca?
        assert :key_cert_sign in cert.key_usage
        assert Certificate.signed_by?(cert, cert), file
        assert {:rsa, n, _e} = cert.public_key
        assert bit_size(n) == 4096
      end
    end
  end

  describe "names" do
    test "values that are not UTF-8 are compared byte for byte instead of crashing" do
      latin1 =
        PKI.seq([
          PKI.set([PKI.seq([PKI.oid("2.5.4.3"), PKI.tlv(0x14, <<"DIRECCI", 0xD3, "N">>)])])
        ])

      {:ok, a} = Certificate.parse_name(latin1)
      {:ok, b} = Certificate.parse_name(latin1)
      assert Certificate.same_name?(a, %{b | raw: nil})
      assert Certificate.describe_name(a) =~ "CN=0x"
    end

    test "match by value regardless of string type, case and spacing" do
      printable =
        PKI.seq([
          PKI.set([PKI.seq([PKI.oid("2.5.4.6"), PKI.printable("ES")])]),
          PKI.set([PKI.seq([PKI.oid("2.5.4.3"), PKI.printable("CSCA  SPAIN")])])
        ])

      utf8 =
        PKI.seq([
          PKI.set([PKI.seq([PKI.oid("2.5.4.6"), PKI.utf8("ES")])]),
          PKI.set([PKI.seq([PKI.oid("2.5.4.3"), PKI.utf8("csca spain")])])
        ])

      other =
        PKI.seq([
          PKI.set([PKI.seq([PKI.oid("2.5.4.6"), PKI.utf8("ES")])]),
          PKI.set([PKI.seq([PKI.oid("2.5.4.3"), PKI.utf8("CSCA FRANCE")])])
        ])

      {:ok, a} = Certificate.parse_name(printable)
      {:ok, b} = Certificate.parse_name(utf8)
      {:ok, c} = Certificate.parse_name(other)

      assert Certificate.same_name?(a, b)
      refute Certificate.same_name?(a, c)
      assert {:error, :malformed} = Certificate.parse_name("junk")
    end
  end

  describe "signature algorithms" do
    defp alg(der) do
      {:ok, element} = Der.decode(der)
      Signature.algorithm(element)
    end

    test "RSASSA-PSS defaults (SHA-1, MGF1-SHA1, salt 20) and explicit trailer" do
      assert {:ok, {:rsa_pss, :sha, :sha, 20}} = alg(PKI.seq([PKI.oid("1.2.840.113549.1.1.10")]))

      assert {:ok, {:rsa_pss, :sha, :sha, 20}} =
               alg(PKI.seq([PKI.oid("1.2.840.113549.1.1.10"), PKI.seq([])]))

      assert {:ok, {:rsa_pss, :sha256, :sha256, 32}} =
               alg(
                 PKI.seq([
                   PKI.oid("1.2.840.113549.1.1.10"),
                   PKI.seq([
                     PKI.explicit(0, PKI.seq([PKI.oid("2.16.840.1.101.3.4.2.1")])),
                     PKI.explicit(
                       1,
                       PKI.seq([
                         PKI.oid("1.2.840.113549.1.1.8"),
                         PKI.seq([PKI.oid("2.16.840.1.101.3.4.2.1")])
                       ])
                     ),
                     PKI.explicit(2, PKI.int(32)),
                     PKI.explicit(3, PKI.int(1))
                   ])
                 ])
               )
    end

    test "invalid PSS parameters" do
      for params <- [
            PKI.seq([PKI.explicit(3, PKI.int(2))]),
            PKI.seq([PKI.explicit(0, PKI.seq([PKI.oid("1.2.3")]))]),
            PKI.seq([PKI.explicit(1, PKI.seq([PKI.oid("1.2.3"), PKI.null()]))]),
            PKI.seq([PKI.explicit(5, PKI.null())]),
            PKI.int(1)
          ] do
        assert {:error, :unsupported_algorithm} =
                 alg(PKI.seq([PKI.oid("1.2.840.113549.1.1.10"), params]))
      end
    end

    test "key-only identifiers take the SignerInfo digest" do
      {:ok, rsa} = Der.decode(PKI.seq([PKI.oid("1.2.840.113549.1.1.1"), PKI.null()]))
      {:ok, ec} = Der.decode(PKI.seq([PKI.oid("1.2.840.10045.2.1")]))

      assert {:ok, {:rsa_pkcs1, :sha384}} = Signature.algorithm(rsa, :sha384)
      assert {:ok, {:ecdsa, :sha256}} = Signature.algorithm(ec, :sha256)
      assert {:error, :unsupported_algorithm} = Signature.algorithm(rsa)
    end

    test "unknown algorithms and malformed identifiers" do
      assert {:error, :unsupported_algorithm} = alg(PKI.seq([PKI.oid("1.3.101.112")]))
      assert {:error, :unsupported_algorithm} = alg(PKI.int(5))

      assert {:error, :unsupported_algorithm} =
               Signature.digest(elem(Der.decode(PKI.seq([PKI.oid("1.2.3")])), 1))
    end

    test "verify never raises and mismatched keys are false" do
      ec = PKI.key({:ec, :secp256r1})
      sig = PKI.sign("hola", ec, {:ecdsa, :sha256})
      key = {:ec, ec.public, :secp256r1}

      assert Signature.verify({:ecdsa, :sha256}, "hola", sig, key)
      refute Signature.verify({:ecdsa, :sha256}, "hola", "garbage", key)
      refute Signature.verify({:ecdsa, :sha256}, "hola", sig, {:ec, "bad point", :secp256r1})
      refute Signature.verify({:ecdsa_plain, :sha256}, "hola", <<1, 2, 3>>, key)
      refute Signature.verify({:rsa_pkcs1, :sha256}, "hola", sig, key)
      refute Signature.verify({:rsa_pss, :sha256, :sha256, 32}, "hola", sig, {:rsa, <<0>>, <<0>>})
    end
  end
end
