defmodule Cherry.Identity.Document.MrzTest do
  use ExUnit.Case, async: true

  alias Cherry.Identity.Document.Mrz
  alias Cherry.TestSupport.DocumentPKI, as: PKI

  @today ~D[2026-10-09]

  # Fictitious specimens printed in ICAO Doc 9303 (Utopia, "Anna Maria Eriksson").
  @icao_td3 "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<" <>
              "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
  @icao_td1 "I<UTOD231458907<<<<<<<<<<<<<<<" <>
              "7408122F1204159UTO<<<<<<<<<<<6" <>
              "ERIKSSON<<ANNA<MARIA<<<<<<<<<<"

  describe "check digits" do
    test "ICAO examples" do
      assert Mrz.check_digit("L898902C3") == 6
      assert Mrz.check_digit("740812") == 2
      assert Mrz.check_digit("120415") == 9
      assert Mrz.check_digit("ZE184226B<<<<<") == 1
      assert Mrz.check_digit("D23145890") == 7
    end
  end

  describe "ICAO specimens" do
    test "TD3" do
      assert {:ok, mrz} = Mrz.parse(@icao_td3, @today)
      assert mrz.format == :td3
      assert mrz.document_code == "P"
      assert mrz.issuing_state == "UTO"
      assert mrz.document_number == "L898902C3"
      assert mrz.birth_date == ~D[1974-08-12]
      assert mrz.expiry_date == ~D[2012-04-15]
      assert mrz.nationality == "UTO"
      # Only Spanish documents expose a personal number for the fingerprint.
      assert mrz.personal_number == nil
    end

    test "TD1" do
      assert {:ok, mrz} = Mrz.parse(@icao_td1, @today)
      assert mrz.format == :td1
      assert mrz.document_code == "I"
      assert mrz.document_number == "D23145890"
      assert mrz.birth_date == ~D[1974-08-12]
    end

    test "every check digit is verified" do
      # number, birth, expiry, personal number and composite check digits of TD3
      for position <- [44 + 9, 44 + 19, 44 + 27, 44 + 42, 44 + 43] do
        assert {:error, :invalid_check_digit} = Mrz.parse(bump(@icao_td3, position), @today),
               "position #{position}"
      end

      # number, birth, expiry and composite of TD1
      for position <- [14, 30 + 6, 30 + 14, 30 + 29] do
        assert {:error, :invalid_check_digit} = Mrz.parse(bump(@icao_td1, position), @today),
               "position #{position}"
      end
    end

    test "a changed field is caught by its check digit" do
      # Birth date 740812 → 750812 keeps the format but breaks the check digit.
      altered = String.replace(@icao_td3, "7408122F", "7508122F")
      assert {:error, :invalid_check_digit} = Mrz.parse(altered, @today)
    end
  end

  defp bump(mrz, position) do
    <<head::binary-size(position), digit, rest::binary>> = mrz
    head <> <<if(digit == ?9, do: ?0, else: digit + 1)>> <> rest
  end

  describe "Spanish documents" do
    test "DNI: document number and DNI number from the optional data" do
      mrz = PKI.td1(document_number: "ZZZ123456", personal_number: PKI.dni(12_345_678))

      assert {:ok, %{document_number: "ZZZ123456", personal_number: "12345678Z"}} =
               Mrz.parse(mrz, @today)
    end

    test "NIE numbers are accepted as personal numbers" do
      # X1234567L: X → 0, 01234567 mod 23 = 19 → L
      mrz = PKI.td1(personal_number: "X1234567L")
      assert {:ok, %{personal_number: "X1234567L"}} = Mrz.parse(mrz, @today)
    end

    test "an optional data field without a valid DNI/NIE gives no personal number" do
      for optional <- ["12345678A", "ABC", ""] do
        mrz = PKI.td1(personal_number: optional)
        assert {:ok, %{personal_number: nil}} = Mrz.parse(mrz, @today)
      end
    end

    test "non-Spanish documents never use the optional data" do
      mrz = PKI.td1(state: "XXA", personal_number: PKI.dni(12_345_678))
      assert {:ok, %{personal_number: nil}} = Mrz.parse(mrz, @today)
    end

    test "valid_spanish_id?/1" do
      assert Mrz.valid_spanish_id?("00000000T")
      assert Mrz.valid_spanish_id?("Y0000000Z")
      refute Mrz.valid_spanish_id?("00000000A")
      refute Mrz.valid_spanish_id?("W0000000T")
      refute Mrz.valid_spanish_id?("1234")
    end
  end

  describe "TD1 long document numbers" do
    test "continue in the optional data after a '<' check digit" do
      number = "ZZ12345678901"
      extra = "8901"
      check = Integer.to_string(Mrz.check_digit(number))
      line1 = "IDXXA" <> "ZZ1234567" <> "<" <> String.pad_trailing(extra <> check, 15, "<")
      cd = &Integer.to_string(Mrz.check_digit(&1))

      line2_head =
        "900517" <>
          cd.("900517") <> "F310517" <> cd.("310517") <> "XXA" <> String.duplicate("<", 11)

      composite =
        binary_part(line1, 5, 25) <>
          binary_part(line2_head, 0, 7) <>
          binary_part(line2_head, 8, 7) <> binary_part(line2_head, 18, 11)

      mrz =
        line1 <>
          line2_head <>
          Integer.to_string(Mrz.check_digit(composite)) <> String.pad_trailing("TEST", 30, "<")

      assert {:ok, %{document_number: ^number}} = Mrz.parse(mrz, @today)
    end
  end

  describe "birth dates" do
    test "two-digit years never land in the future" do
      assert {:ok, %{birth_date: ~D[2008-10-09]}} =
               Mrz.parse(PKI.td1(birth: "081009"), @today)

      assert {:ok, %{birth_date: ~D[1926-10-10]}} =
               Mrz.parse(PKI.td1(birth: "261010"), @today)

      assert {:ok, %{birth_date: ~D[1930-01-01]}} =
               Mrz.parse(PKI.td1(birth: "300101"), @today)
    end

    test "unknown day or month resolve to the latest possible date" do
      assert {:ok, %{birth_date: ~D[1990-05-31]}} = Mrz.parse(PKI.td1(birth: "9005<<"), @today)
      assert {:ok, %{birth_date: ~D[1990-12-31]}} = Mrz.parse(PKI.td1(birth: "90<<<<"), @today)
    end

    test "unknown parts in the current year never roll back a century" do
      # A child born this year with an unknown day or month is not 99.
      assert {:ok, %{birth_date: ~D[2026-10-09]}} = Mrz.parse(PKI.td1(birth: "26<<<<"), @today)
      assert {:ok, %{birth_date: ~D[2026-10-09]}} = Mrz.parse(PKI.td1(birth: "2610<<"), @today)
      assert {:ok, %{birth_date: ~D[2026-09-30]}} = Mrz.parse(PKI.td1(birth: "2609<<"), @today)
      assert {:ok, %{birth_date: ~D[2026-10-09]}} = Mrz.parse(PKI.td1(birth: "26<<05"), @today)
      assert {:ok, %{birth_date: ~D[1927-12-31]}} = Mrz.parse(PKI.td1(birth: "27<<<<"), @today)
    end

    test "implausible ages are malformed" do
      assert {:error, :malformed_dg1} = Mrz.parse(PKI.td1(birth: "261011"), ~D[2146-10-12])
    end

    test "an impossible date is malformed" do
      assert {:error, :malformed_dg1} = Mrz.parse(PKI.td1(birth: "900230"), @today)
    end

    test "an expiry that is not a date (no expiry) is not an error" do
      assert {:ok, %{expiry_date: nil}} = Mrz.parse(PKI.td1(expiry: "<<<<<<"), @today)
    end
  end

  describe "formats" do
    test "TD2 is not supported and other lengths are malformed" do
      assert {:error, :unsupported_document} = Mrz.parse(String.duplicate("<", 72), @today)
      assert {:error, :malformed_dg1} = Mrz.parse(String.duplicate("<", 50), @today)
      assert {:error, :malformed_dg1} = Mrz.parse(String.replace(@icao_td3, "P<", "p<"), @today)
    end

    test "DG1 wrapper" do
      assert {:ok, %{format: :td3}} = Mrz.parse_dg1(PKI.dg1(@icao_td3), @today)
      assert {:error, :malformed_dg1} = Mrz.parse_dg1(@icao_td3, @today)
      assert {:error, :malformed_dg1} = Mrz.parse_dg1(<<0x61, 0x05, 1, 2>>, @today)
    end
  end

  describe "age/2" do
    test "counts completed years" do
      assert Mrz.age(~D[2008-10-09], ~D[2026-10-09]) == 18
      assert Mrz.age(~D[2008-10-10], ~D[2026-10-09]) == 17
      assert Mrz.age(~D[1990-01-01], ~D[2026-10-09]) == 36
    end

    test "29 February birthdays count from 1 March in common years" do
      assert Mrz.age(~D[2008-02-29], ~D[2026-02-28]) == 17
      assert Mrz.age(~D[2008-02-29], ~D[2026-03-01]) == 18
      assert Mrz.age(~D[2008-02-29], ~D[2028-02-29]) == 20
    end
  end
end
