defmodule Mix.Tasks.Cherry.CscaTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureIO

  alias Cherry.TestSupport.DocumentPKI, as: PKI

  setup do
    dir = Path.join(System.tmp_dir!(), "csca-task-#{System.unique_integer([:positive])}")
    File.mkdir_p!(dir)
    on_exit(fn -> File.rm_rf!(dir) end)
    %{dir: dir}
  end

  # Unsigned stand-in for a CSCA master list: the task never checks the signature.
  defp master_list(certs) do
    list = PKI.seq([PKI.int(0), PKI.set(certs)])

    signed_data =
      PKI.seq([
        PKI.int(3),
        PKI.set([]),
        PKI.seq([PKI.oid("2.23.136.1.1.2"), PKI.explicit(0, PKI.octet(list))]),
        PKI.set([])
      ])

    PKI.seq([PKI.oid("1.2.840.113549.1.7.2"), PKI.explicit(0, signed_data)])
  end

  test "lists and exports the certificates of one country from a master list", %{dir: dir} do
    es = PKI.csca(cn: "CSCA TEST ES", country: "ES")
    fr = PKI.csca(cn: "CSCA TEST FR", country: "FR", key: PKI.key({:ec, :secp256r1}))
    ml = Path.join(dir, "list.ml")
    File.write!(ml, master_list([es.der, fr.der]))
    export = Path.join(dir, "out")

    output =
      capture_io(fn -> Mix.Tasks.Cherry.Csca.run([ml, "--country", "ES", "--export", export]) end)

    assert output =~ "1 certificate(s)"
    assert output =~ "CN=csca test es"
    assert output =~ "RSA 2048"
    assert output =~ "self-signed, signature ok"
    refute output =~ "csca test fr"
    assert [pem] = File.ls!(export)
    assert [der] = Cherry.Identity.Document.TrustStore.read_file(Path.join(export, pem))
    assert der == es.der
  end

  test "lists files and directories", %{dir: dir} do
    File.write!(Path.join(dir, "a.der"), PKI.csca(cn: "CSCA FILE").der)
    output = capture_io(fn -> Mix.Tasks.Cherry.Csca.run([dir]) end)
    assert output =~ "CN=csca file"
  end

  test "rejects files that are not master lists", %{dir: dir} do
    path = Path.join(dir, "bad.ml")
    File.write!(path, PKI.seq([PKI.int(1)]))
    assert_raise Mix.Error, fn -> Mix.Tasks.Cherry.Csca.run([path]) end
  end
end
