defmodule Cherry.TestSupport.DocumentPKI do
  @moduledoc """
  Synthetic eMRTD PKI for tests: CSCA → Document Signer → EF.SOD, plus fake
  DG1 (MRZ) and DG2. Everything is generated here; no real document data and no
  photos of real people (DG2 is random bytes behind a JPEG-like header).

  Names use the user-assigned country code "XX" or "ESP" with obviously fake
  numbers, and the subjects say "TEST".
  """

  import Bitwise

  alias Cherry.Identity.Document.Mrz

  # ── DER encoder ──────────────────────────────────────────────────────

  def tlv(tag, content) when is_integer(tag), do: <<tag>> <> len(byte_size(content)) <> content
  def tlv(tag, content) when is_binary(tag), do: tag <> len(byte_size(content)) <> content

  defp len(n) when n < 0x80, do: <<n>>

  defp len(n) do
    bytes = :binary.encode_unsigned(n)
    <<0x80 + byte_size(bytes)>> <> bytes
  end

  def seq(items), do: tlv(0x30, IO.iodata_to_binary(items))
  # DER SET OF: elements sorted by their encoding.
  def set(items), do: tlv(0x31, items |> Enum.sort() |> IO.iodata_to_binary())
  def null, do: <<5, 0>>
  def bool(true), do: <<1, 1, 0xFF>>
  def octet(bin), do: tlv(0x04, bin)
  def bitstring(bin, unused \\ 0), do: tlv(0x03, <<unused>> <> bin)
  def utf8(str), do: tlv(0x0C, str)
  def printable(str), do: tlv(0x13, str)
  def explicit(n, der), do: tlv(0xA0 + n, der)
  def implicit(n, content), do: tlv(0xA0 + n, content)
  def implicit_primitive(n, content), do: tlv(0x80 + n, content)

  def int(i) when i >= 0 do
    bytes = :binary.encode_unsigned(i)
    bytes = if (:binary.first(bytes) &&& 0x80) != 0, do: <<0>> <> bytes, else: bytes
    tlv(0x02, bytes)
  end

  def oid(dotted) do
    [a, b | rest] = dotted |> String.split(".") |> Enum.map(&String.to_integer/1)
    tlv(0x06, IO.iodata_to_binary([40 * a + b | Enum.map(rest, &base128/1)]))
  end

  defp base128(n) when n < 0x80, do: <<n>>

  defp base128(n) do
    groups =
      Stream.unfold(n, fn
        0 -> nil
        x -> {x &&& 0x7F, x >>> 7}
      end)
      |> Enum.reverse()

    {init, [last]} = Enum.split(groups, -1)
    IO.iodata_to_binary(Enum.map(init, &(&1 ||| 0x80)) ++ [last])
  end

  defp time(%DateTime{year: year} = dt) when year < 2050,
    do: tlv(0x17, Calendar.strftime(dt, "%y%m%d%H%M%SZ"))

  defp time(dt), do: tlv(0x18, Calendar.strftime(dt, "%Y%m%d%H%M%SZ"))

  # ── Keys and algorithms ─────────────────────────────────────────────

  @digest_oids %{
    sha: "1.3.14.3.2.26",
    sha224: "2.16.840.1.101.3.4.2.4",
    sha256: "2.16.840.1.101.3.4.2.1",
    sha384: "2.16.840.1.101.3.4.2.2",
    sha512: "2.16.840.1.101.3.4.2.3"
  }

  @curve_oids %{
    secp256r1: "1.2.840.10045.3.1.7",
    brainpoolP256r1: "1.3.36.3.3.2.8.1.1.7",
    brainpoolP384r1: "1.3.36.3.3.2.8.1.1.11"
  }

  @doc "A key; RSA keys are cached per name because generating them is slow."
  def key(kind, name \\ :default)

  def key(:rsa, name) do
    cache({:rsa, name}, fn ->
      {:RSAPrivateKey, _, n, e, _, _, _, _, _, _, _} =
        priv = :public_key.generate_key({:rsa, 2048, 65_537})

      %{type: :rsa, private: priv, n: n, e: e}
    end)
  end

  def key({:ec, curve}, _name) do
    {pub, priv} = :crypto.generate_key(:ecdh, curve)
    %{type: :ec, curve: curve, public: pub, private: priv}
  end

  defp cache(key, fun) do
    case :persistent_term.get({__MODULE__, key}, nil) do
      nil ->
        value = fun.()
        :persistent_term.put({__MODULE__, key}, value)
        value

      value ->
        value
    end
  end

  defp spki(%{type: :rsa, n: n, e: e}, _opts),
    do: seq([seq([oid("1.2.840.113549.1.1.1"), null()]), bitstring(seq([int(n), int(e)]))])

  defp spki(%{type: :ec, curve: curve, public: pub}, opts) do
    params =
      if opts[:explicit_params] do
        {{:prime_field, p}, {a, b, _seed}, g, n, h} = :crypto.ec_curve(curve)

        seq([
          int(1),
          seq([oid("1.2.840.10045.1.1"), int(:binary.decode_unsigned(p))]),
          seq([octet(a), octet(b)]),
          octet(g),
          int(:binary.decode_unsigned(n)),
          int(:binary.decode_unsigned(h))
        ])
      else
        oid(Map.fetch!(@curve_oids, curve))
      end

    seq([seq([oid("1.2.840.10045.2.1"), params]), bitstring(pub)])
  end

  @doc "AlgorithmIdentifier for a signature scheme."
  def signature_algorithm({:rsa_pkcs1, digest}) do
    oid =
      %{
        sha: "1.2.840.113549.1.1.5",
        sha256: "1.2.840.113549.1.1.11",
        sha384: "1.2.840.113549.1.1.12",
        sha512: "1.2.840.113549.1.1.13"
      }[digest]

    seq([oid(oid), null()])
  end

  def signature_algorithm({:rsa_pss, digest, salt}) do
    hash = seq([oid(@digest_oids[digest]), null()])

    seq([
      oid("1.2.840.113549.1.1.10"),
      seq([
        explicit(0, hash),
        explicit(1, seq([oid("1.2.840.113549.1.1.8"), hash])),
        explicit(2, int(salt))
      ])
    ])
  end

  def signature_algorithm({:ecdsa, digest}) do
    oid =
      %{
        sha: "1.2.840.10045.4.1",
        sha256: "1.2.840.10045.4.3.2",
        sha384: "1.2.840.10045.4.3.3",
        sha512: "1.2.840.10045.4.3.4"
      }[digest]

    seq([oid(oid)])
  end

  def signature_algorithm({:ecdsa_plain, digest}) do
    seq([oid("0.4.0.127.0.7.1.1.4.1." <> %{sha256: "3", sha384: "4"}[digest])])
  end

  def default_scheme(%{type: :rsa}), do: {:rsa_pkcs1, :sha256}
  def default_scheme(%{type: :ec}), do: {:ecdsa, :sha256}

  @doc "Signs `message` with `key` using `scheme`."
  def sign(message, %{type: :rsa, private: priv}, {:rsa_pkcs1, digest}),
    do: :public_key.sign(message, digest, priv)

  def sign(message, %{type: :rsa, private: priv}, {:rsa_pss, digest, salt}) do
    :public_key.sign(message, digest, priv,
      rsa_padding: :rsa_pkcs1_pss_padding,
      rsa_pss_saltlen: salt,
      rsa_mgf1_md: digest
    )
  end

  def sign(message, %{type: :ec, private: priv, curve: curve}, {:ecdsa, digest}),
    do: :crypto.sign(:ecdsa, digest, message, [priv, curve])

  def sign(message, %{type: :ec} = key, {:ecdsa_plain, digest}) do
    der = sign(message, key, {:ecdsa, digest})
    {:ok, el} = Cherry.Identity.Document.Der.decode(der)
    {:ok, [r, s]} = Cherry.Identity.Document.Der.children(el)
    {:ok, r} = Cherry.Identity.Document.Der.integer(r)
    {:ok, s} = Cherry.Identity.Document.Der.integer(s)
    size = div(curve_bits(key.curve) + 7, 8)
    <<r::size(size * 8), s::size(size * 8)>>
  end

  defp curve_bits(curve), do: %{secp256r1: 256, brainpoolP256r1: 256, brainpoolP384r1: 384}[curve]

  # ── Certificates ────────────────────────────────────────────────────

  def name(cn, country \\ "XX"),
    do:
      seq([
        set([seq([oid("2.5.4.6"), printable(country)])]),
        set([seq([oid("2.5.4.10"), utf8("Cherry Test PKI")])]),
        set([seq([oid("2.5.4.3"), utf8(cn)])])
      ])

  @doc """
  Builds a certificate. Returns `%{der, key, name, serial, ski}`.

  Options: `:cn`, `:key`, `:issuer` (a certificate map; default self-signed),
  `:serial`, `:not_before`, `:not_after`, `:ca` (boolean), `:key_usage`
  (`:ca` | `:signer` | nil), `:scheme`, `:explicit_params`,
  `:extra_extensions` (list of `{oid, critical?, der_value}`), `:ski`, `:aki`.
  """
  def certificate(opts) do
    key = Keyword.fetch!(opts, :key)
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    subject = name(Keyword.fetch!(opts, :cn), Keyword.get(opts, :country, "XX"))
    serial = Keyword.get(opts, :serial, :rand.uniform(1_000_000_000))
    ski = Keyword.get(opts, :ski, :crypto.strong_rand_bytes(20))

    {issuer_name, issuer_key, issuer_ski} =
      case Keyword.get(opts, :issuer) do
        nil -> {subject, key, ski}
        issuer -> {issuer.name, issuer.key, issuer.ski}
      end

    scheme = Keyword.get(opts, :scheme, default_scheme(issuer_key))
    sig_alg = signature_algorithm(scheme)

    extensions =
      [
        {"2.5.29.14", false, octet(ski)},
        {"2.5.29.35", false, seq([implicit_primitive(0, Keyword.get(opts, :aki, issuer_ski))])}
      ] ++
        if(Keyword.get(opts, :ca, false),
          do: [{"2.5.29.19", true, seq([bool(true)])}],
          else: []
        ) ++
        case Keyword.get(opts, :key_usage) do
          :ca -> [{"2.5.29.15", true, bitstring(<<0x06>>, 1)}]
          :signer -> [{"2.5.29.15", true, bitstring(<<0x80>>, 7)}]
          nil -> []
        end ++ Keyword.get(opts, :extra_extensions, [])

    ext_der =
      for {ext_oid, critical?, value} <- extensions do
        seq([oid(ext_oid)] ++ if(critical?, do: [bool(true)], else: []) ++ [octet(value)])
      end

    tbs =
      seq([
        explicit(0, int(2)),
        int(serial),
        sig_alg,
        issuer_name,
        seq([
          time(Keyword.get(opts, :not_before, DateTime.add(now, -30, :day))),
          time(Keyword.get(opts, :not_after, DateTime.add(now, 3650, :day)))
        ]),
        subject,
        spki(key, opts),
        explicit(3, seq(ext_der))
      ])

    der = seq([tbs, sig_alg, bitstring(sign(tbs, issuer_key, scheme))])
    %{der: der, key: key, name: subject, serial: serial, ski: ski}
  end

  @doc "CSCA (self-signed CA) with sensible defaults."
  def csca(opts \\ []) do
    certificate(
      Keyword.merge(
        [cn: "CSCA TEST", key: key(:rsa, :csca), ca: true, key_usage: :ca],
        opts
      )
    )
  end

  @doc "Document Signer issued by `csca`."
  def document_signer(csca, opts \\ []) do
    certificate(
      Keyword.merge(
        [
          cn: "DS TEST",
          key: key(:rsa, :ds),
          issuer: csca,
          key_usage: :signer,
          not_after: DateTime.add(DateTime.utc_now(), 3650, :day) |> DateTime.truncate(:second)
        ],
        opts
      )
    )
  end

  # ── Data groups and SOD ─────────────────────────────────────────────

  def dg1(mrz), do: tlv(0x61, tlv(<<0x5F, 0x1F>>, mrz))

  @doc "Fake DG2: random bytes behind a JPEG header (not a photo of anybody)."
  def dg2(size \\ 2_000),
    do: tlv(0x75, tlv(<<0x7F, 0x61>>, <<0xFF, 0xD8, 0xFF>> <> :crypto.strong_rand_bytes(size)))

  @doc """
  EF.SOD signing the given data groups (`%{number => bytes}`) with `ds`.

  Options: `:digest` (LDS hashes, default :sha256), `:scheme` (SignerInfo
  signature), `:signer_digest`, `:sid` (`:issuer_serial` | `:ski`),
  `:signed_attrs` (default true), `:include_certificate` (default true),
  `:tamper` (`:signature` | `:message_digest` | `:content_type`),
  `:override_hashes` (`%{number => hash}`).
  """
  def sod(data_groups, ds, opts \\ []) do
    digest = Keyword.get(opts, :digest, :sha256)
    signer_digest = Keyword.get(opts, :signer_digest, digest)
    scheme = Keyword.get(opts, :scheme, default_scheme(ds.key))

    hashes =
      Map.merge(
        Map.new(data_groups, fn {n, data} -> {n, :crypto.hash(digest, data)} end),
        Keyword.get(opts, :override_hashes, %{})
      )

    lds =
      seq([
        int(0),
        seq([oid(@digest_oids[digest])]),
        seq(for {n, hash} <- Enum.sort(hashes), do: seq([int(n), octet(hash)]))
      ])

    lds_oid = Keyword.get(opts, :content_type, "2.23.136.1.1.1")

    attrs = [
      seq([
        oid("1.2.840.113549.1.9.3"),
        set([oid(if(opts[:tamper] == :content_type, do: "1.2.840.113549.1.7.1", else: lds_oid))])
      ]),
      seq([
        oid("1.2.840.113549.1.9.4"),
        set([octet(message_digest(signer_digest, lds, opts[:tamper]))])
      ])
    ]

    signed_attrs? = Keyword.get(opts, :signed_attrs, true)
    to_sign = if signed_attrs?, do: set(attrs), else: lds
    signature = sign(to_sign, ds.key, scheme)

    signature =
      if opts[:tamper] == :signature,
        do: :crypto.exor(signature, <<1>> <> :binary.copy(<<0>>, byte_size(signature) - 1)),
        else: signature

    sid =
      case Keyword.get(opts, :sid, :issuer_serial) do
        :issuer_serial -> seq([issuer_of(ds), int(ds.serial)])
        :ski -> implicit_primitive(0, ds.ski)
      end

    signer_info =
      seq(
        [
          int(if(opts[:sid] == :ski, do: 3, else: 1)),
          sid,
          seq([oid(@digest_oids[signer_digest])])
        ] ++
          if(signed_attrs?,
            do: [implicit(0, attrs |> Enum.sort() |> IO.iodata_to_binary())],
            else: []
          ) ++
          [signature_algorithm(scheme), octet(signature)]
      )

    certs = if Keyword.get(opts, :include_certificate, true), do: [implicit(0, ds.der)], else: []

    signed_data =
      seq(
        [
          int(3),
          set([seq([oid(@digest_oids[signer_digest])])]),
          seq([oid(lds_oid), explicit(0, octet(lds))])
        ] ++ certs ++ [set([signer_info])]
      )

    tlv(0x77, seq([oid("1.2.840.113549.1.7.2"), explicit(0, signed_data)]))
  end

  defp message_digest(digest, lds, :message_digest),
    do: :crypto.hash(digest, lds <> "tampered")

  defp message_digest(digest, lds, _tamper), do: :crypto.hash(digest, lds)

  # Issuer name of the DS = subject of its CSCA, read back from the DER.
  defp issuer_of(%{der: der}) do
    {:ok, cert} = Cherry.Identity.Document.Der.decode(der)
    {:ok, [tbs | _]} = Cherry.Identity.Document.Der.children(cert)
    {:ok, fields} = Cherry.Identity.Document.Der.children(tbs)
    [_version, _serial, _alg, {_, _, issuer} | _] = fields
    issuer
  end

  # ── MRZ ─────────────────────────────────────────────────────────────

  @doc """
  TD1 MRZ (90 characters) like the Spanish DNI. Options: `:state`,
  `:document_number`, `:personal_number` (optional data 1), `:birth`
  (`Date`), `:expiry` (`Date` or "YYMMDD"), `:code`.
  """
  def td1(opts \\ []) do
    state = Keyword.get(opts, :state, "ESP")
    number = pad(Keyword.get(opts, :document_number, "ZZZ000001"), 9)
    optional1 = pad(Keyword.get(opts, :personal_number, "00000000T"), 15)
    birth = yymmdd(Keyword.get(opts, :birth, ~D[1990-05-17]))
    expiry = yymmdd(Keyword.get(opts, :expiry, ~D[2031-05-17]))
    code = pad(Keyword.get(opts, :code, "ID"), 2)

    line1 = code <> state <> number <> cd(number) <> optional1
    optional2 = pad("", 11)
    nationality = Keyword.get(opts, :nationality, state)

    line2_head = birth <> cd(birth) <> "F" <> expiry <> cd(expiry) <> nationality <> optional2

    composite =
      binary_part(line1, 5, 25) <>
        binary_part(line2_head, 0, 7) <>
        binary_part(line2_head, 8, 7) <>
        binary_part(line2_head, 18, 11)

    line3 = pad("PRUEBA<<CHERRY<TEST", 30)
    line1 <> line2_head <> cd(composite) <> line3
  end

  @doc "TD3 MRZ (88 characters) for passports."
  def td3(opts \\ []) do
    state = Keyword.get(opts, :state, "ESP")
    line1 = pad("P<" <> state <> "PRUEBA<<CHERRY<TEST", 44)
    number = pad(Keyword.get(opts, :document_number, "ZZ0000001"), 9)
    birth = yymmdd(Keyword.get(opts, :birth, ~D[1990-05-17]))
    expiry = yymmdd(Keyword.get(opts, :expiry, ~D[2031-05-17]))
    personal = pad(Keyword.get(opts, :personal_number, ""), 14)
    personal_cd = if String.trim(personal, "<") == "", do: "<", else: cd(personal)

    head =
      number <>
        cd(number) <>
        state <>
        birth <>
        cd(birth) <>
        "M" <>
        expiry <>
        cd(expiry) <>
        personal <> personal_cd

    composite = binary_part(head, 0, 10) <> binary_part(head, 13, 7) <> binary_part(head, 21, 22)
    line1 <> head <> cd(composite)
  end

  defp yymmdd(%Date{} = d), do: Calendar.strftime(d, "%y%m%d")
  defp yymmdd(bin) when is_binary(bin), do: bin

  defp cd(data), do: Integer.to_string(Mrz.check_digit(data))

  defp pad(value, size), do: String.pad_trailing(value, size, "<") |> binary_part(0, size)

  @doc "Valid synthetic DNI number (8 digits + control letter) for `n`."
  def dni(n) do
    digits = n |> Integer.to_string() |> String.pad_leading(8, "0")
    digits <> String.at("TRWAGMYFPDXBNJZSQVHLCKE", rem(n, 23))
  end

  @doc """
  A complete valid document: `%{csca, ds, dg1, dg2, sod, anchors}`. The SOD
  signs DG2 too, as on real chips, although the server never takes it.
  Options are passed to `td1/1` (or `td3/1` with `format: :td3`) and `sod/3`.
  """
  def document(opts \\ []) do
    csca = Keyword.get_lazy(opts, :csca, fn -> csca() end)
    ds = Keyword.get_lazy(opts, :ds, fn -> document_signer(csca) end)
    mrz = if opts[:format] == :td3, do: td3(opts), else: td1(opts)
    dg1 = dg1(mrz)
    dg2 = dg2()
    sod = sod(%{1 => dg1, 2 => dg2}, ds, opts)
    {:ok, anchor} = Cherry.Identity.Document.Certificate.parse(csca.der)
    %{csca: csca, ds: ds, dg1: dg1, dg2: dg2, sod: sod, anchors: [anchor]}
  end
end
