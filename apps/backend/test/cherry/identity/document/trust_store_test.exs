defmodule Cherry.Identity.Document.TrustStoreTest do
  use ExUnit.Case, async: false

  @moduletag :capture_log

  alias Cherry.Identity.Document.TrustStore
  alias Cherry.TestSupport.DocumentPKI, as: PKI

  setup do
    previous = Application.get_env(:cherry, TrustStore)
    dir = Path.join(System.tmp_dir!(), "csca-#{System.unique_integer([:positive])}")
    File.mkdir_p!(Path.join(dir, "nested"))

    on_exit(fn ->
      if previous,
        do: Application.put_env(:cherry, TrustStore, previous),
        else: Application.delete_env(:cherry, TrustStore)

      TrustStore.reload()
      File.rm_rf!(dir)
    end)

    %{dir: dir}
  end

  test "reads PEM (several per file, with text around) and DER files recursively", %{dir: dir} do
    a = PKI.csca(cn: "CSCA A")
    b = PKI.csca(cn: "CSCA B", key: PKI.key({:ec, :secp256r1}))
    c = PKI.csca(cn: "CSCA C", key: PKI.key({:ec, :brainpoolP256r1}), explicit_params: true)

    pem =
      :public_key.pem_encode([
        {:Certificate, a.der, :not_encrypted},
        {:Certificate, b.der, :not_encrypted}
      ])

    File.write!(Path.join(dir, "two.pem"), "Subject: CSCA A and B\n" <> pem)
    File.write!(Path.join([dir, "nested", "c.der"]), c.der)
    File.write!(Path.join(dir, "README.md"), "not a certificate")
    File.write!(Path.join(dir, "broken.crt"), "garbage")

    Application.put_env(:cherry, TrustStore, paths: [dir])

    ders = TrustStore.reload() |> Enum.map(& &1.der) |> MapSet.new()
    assert ders == MapSet.new([a.der, b.der, c.der])
  end

  test "certificates from config and missing paths", %{dir: dir} do
    a = PKI.csca(cn: "CSCA CONFIG")

    Application.put_env(:cherry, TrustStore,
      paths: [Path.join(dir, "missing")],
      certificates: [a.der, a.der]
    )

    assert [%{der: der}] = TrustStore.reload()
    assert der == a.der
  end

  test "the cache follows configuration changes" do
    a = PKI.csca(cn: "CSCA ONE")
    b = PKI.csca(cn: "CSCA TWO")

    Application.put_env(:cherry, TrustStore, paths: [], certificates: [a.der])
    assert [%{der: der_a}] = TrustStore.anchors()
    assert der_a == a.der

    Application.put_env(:cherry, TrustStore, paths: [], certificates: [b.der])
    assert [%{der: der_b}] = TrustStore.anchors()
    assert der_b == b.der
  end

  test "the CSCA directory shipped with the app parses completely" do
    Application.put_env(:cherry, TrustStore, paths: [Application.app_dir(:cherry, "priv/csca")])
    shipped = TrustStore.files(Application.app_dir(:cherry, "priv/csca"))

    expected =
      shipped |> Enum.flat_map(&TrustStore.read_file/1) |> Enum.uniq() |> length()

    assert length(TrustStore.reload()) == expected
  end
end
