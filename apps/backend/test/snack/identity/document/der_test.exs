defmodule Snack.Identity.Document.DerTest do
  use ExUnit.Case, async: true

  alias Snack.Identity.Document.Der
  alias Snack.TestSupport.DocumentPKI, as: PKI

  test "definite short and long lengths" do
    long = :binary.copy(<<1>>, 300)

    assert {:ok, {{:universal, false, 4}, "abc", <<4, 3, "abc">>}} = Der.decode(<<4, 3, "abc">>)
    assert {:ok, {{:universal, false, 4}, ^long, _}} = Der.decode(PKI.octet(long))
  end

  test "indefinite lengths (BER) in constructed elements" do
    ber = <<0x30, 0x80, 0x02, 0x01, 0x05, 0x04, 0x01, 0xAA, 0x00, 0x00>>

    assert {:ok, {{:universal, true, 16}, value, ^ber}} = Der.decode(ber)
    assert {:ok, [five, octets]} = Der.children(value)
    assert {:ok, 5} = Der.integer(five)
    assert {:ok, <<0xAA>>} = Der.octet_string(octets)
  end

  test "constructed OCTET STRING chunks are joined" do
    ber = <<0x24, 0x80, 0x04, 0x02, "ab", 0x04, 0x01, "c", 0x00, 0x00>>
    assert {:ok, element} = Der.decode(ber)
    assert {:ok, "abc"} = Der.octet_string(element)
  end

  test "high tag numbers (application 31 of DG1)" do
    assert {:ok, {{:application, false, 31}, "X", _}} = Der.decode(<<0x5F, 0x1F, 1, "X">>)
  end

  test "rejects truncated, trailing or invalid input" do
    for bad <- [
          <<>>,
          <<4, 5, "ab">>,
          <<4, 1, "a", "b">>,
          <<4, 0x80>>,
          <<0x30, 0x80, 4, 1, "a">>,
          <<4, 0x85, 1, 1, 1, 1, 1>>
        ] do
      assert {:error, :malformed} = Der.decode(bad), "accepted #{inspect(bad)}"
    end
  end

  test "deep nesting is bounded" do
    nested = Enum.reduce(1..40, <<5, 0>>, fn _, acc -> <<0x30, 0x80>> <> acc <> <<0, 0>> end)
    assert {:error, :malformed} = Der.decode(nested)
  end

  test "OIDs and integers" do
    {:ok, oid} = Der.decode(PKI.oid("2.23.136.1.1.1"))
    assert {:ok, "2.23.136.1.1.1"} = Der.oid(oid)

    {:ok, oid} = Der.decode(PKI.oid("1.2.840.113549.1.7.2"))
    assert {:ok, "1.2.840.113549.1.7.2"} = Der.oid(oid)

    assert {:ok, -1} = Der.integer({{:universal, false, 2}, <<0xFF>>, <<>>})
    assert {:ok, 128} = Der.integer({{:universal, false, 2}, <<0, 0x80>>, <<>>})
    assert {:error, :malformed} = Der.integer({{:universal, false, 4}, <<1>>, <<>>})
    assert {:error, :malformed} = Der.oid({{:universal, false, 6}, <<0x81>>, <<>>})
  end
end
