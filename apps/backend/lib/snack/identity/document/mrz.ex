defmodule Snack.Identity.Document.Mrz do
  @moduledoc """
  Machine Readable Zone from DG1 (ICAO 9303 parts 4, 5 and 10).

      DG1 ::= [APPLICATION 1] { [APPLICATION 31 (5F1F)] MRZ characters }

  Supported formats: TD1 (identity cards such as the Spanish DNI and TIE,
  3 × 30) and TD3 (passports, 2 × 44). Every check digit is verified, including
  the composite one.

  For the Spanish DNI (and the TIE of foreign residents) the document number is
  the card's own number, which changes with each renewal, and the DNI/NIE
  number goes in the optional data of line 1. `personal_number` exposes it so
  the fingerprint can follow the person, not the card. Passports never set it:
  the passport of a minor without DNI may carry a parent's DNI in that field.
  """

  @enforce_keys [:format, :document_code, :issuing_state, :document_number, :birth_date]
  defstruct [
    :format,
    :document_code,
    :issuing_state,
    :document_number,
    :birth_date,
    :expiry_date,
    :nationality,
    :personal_number
  ]

  @type t :: %__MODULE__{
          format: :td1 | :td3,
          document_code: String.t(),
          issuing_state: String.t(),
          document_number: String.t(),
          birth_date: Date.t(),
          expiry_date: Date.t() | nil,
          nationality: String.t(),
          personal_number: String.t() | nil
        }

  @type error :: :malformed_dg1 | :invalid_check_digit | :unsupported_document

  @doc """
  Parses DG1. `today` resolves two-digit birth years: the most recent century
  that does not put the birth date in the future.
  """
  @spec parse_dg1(binary(), Date.t()) :: {:ok, t()} | {:error, error()}
  def parse_dg1(<<0x61, _::binary>> = dg1, %Date{} = today) do
    with {:ok, {{:application, true, 1}, value, _}} <- Snack.Identity.Document.Der.decode(dg1),
         {:ok, {{:application, false, 31}, mrz, _}} <- Snack.Identity.Document.Der.decode(value) do
      parse(mrz, today)
    else
      _ -> {:error, :malformed_dg1}
    end
  end

  def parse_dg1(_dg1, _today), do: {:error, :malformed_dg1}

  @doc "Parses the MRZ characters (without line breaks)."
  @spec parse(binary(), Date.t()) :: {:ok, t()} | {:error, error()}
  def parse(mrz, today) when is_binary(mrz) do
    cond do
      not Regex.match?(~r/\A[A-Z0-9<]+\z/, mrz) -> {:error, :malformed_dg1}
      byte_size(mrz) == 90 -> td1(mrz, today)
      byte_size(mrz) == 88 -> td3(mrz, today)
      byte_size(mrz) == 72 -> {:error, :unsupported_document}
      true -> {:error, :malformed_dg1}
    end
  end

  # TD1 line 1: code(2) state(3) number(9) check(1) optional(15)
  #     line 2: birth(6) check sex(1) expiry(6) check nationality(3) optional(11) composite
  defp td1(mrz, today) do
    <<line1::binary-30, line2::binary-30, _line3::binary-30>> = mrz

    <<code::binary-2, state::binary-3, number::binary-9, number_check::binary-1,
      optional1::binary-15>> = line1

    <<birth::binary-6, birth_check::binary-1, _sex::binary-1, expiry::binary-6,
      expiry_check::binary-1, nationality::binary-3, optional2::binary-11,
      composite::binary-1>> = line2

    composite_data =
      binary_part(line1, 5, 25) <>
        binary_part(line2, 0, 7) <> binary_part(line2, 8, 7) <> binary_part(line2, 18, 11)

    with {:ok, number, optional1} <- td1_document_number(number, number_check, optional1),
         :ok <- check(birth, birth_check),
         :ok <- check(expiry, expiry_check),
         :ok <- check(composite_data, composite),
         {:ok, birth_date} <- birth_date(birth, today) do
      {:ok,
       %__MODULE__{
         format: :td1,
         document_code: strip(code),
         issuing_state: strip(state),
         document_number: number,
         birth_date: birth_date,
         expiry_date: expiry_date(expiry),
         nationality: strip(nationality),
         personal_number: personal_number(strip(state), optional1, optional2)
       }}
    end
  end

  # A document number longer than 9 characters continues in the optional data,
  # followed by its check digit, with "<" in the check digit position.
  defp td1_document_number(number, "<", optional) do
    case Regex.run(~r/\A([A-Z0-9]+)([0-9])(<*)(.*)\z/, optional) do
      [_, extra, check, _fill, rest] ->
        full = number <> extra
        with :ok <- check(full, check), do: {:ok, full, rest}

      nil ->
        {:error, :malformed_dg1}
    end
  end

  defp td1_document_number(number, check, optional) do
    with :ok <- check(number, check), do: {:ok, strip(number), optional}
  end

  # TD3 line 2: number(9) check nationality(3) birth(6) check sex expiry(6) check
  #             personal(14) check composite
  defp td3(mrz, today) do
    <<line1::binary-44, line2::binary-44>> = mrz
    <<code::binary-2, state::binary-3, _name::binary-39>> = line1

    <<number::binary-9, number_check::binary-1, nationality::binary-3, birth::binary-6,
      birth_check::binary-1, _sex::binary-1, expiry::binary-6, expiry_check::binary-1,
      personal::binary-14, personal_check::binary-1, composite::binary-1>> = line2

    composite_data =
      binary_part(line2, 0, 10) <> binary_part(line2, 13, 7) <> binary_part(line2, 21, 22)

    with :ok <- check(number, number_check),
         :ok <- check(birth, birth_check),
         :ok <- check(expiry, expiry_check),
         :ok <- check_personal(personal, personal_check),
         :ok <- check(composite_data, composite),
         {:ok, birth_date} <- birth_date(birth, today) do
      {:ok,
       %__MODULE__{
         format: :td3,
         document_code: strip(code),
         issuing_state: strip(state),
         document_number: strip(number),
         birth_date: birth_date,
         expiry_date: expiry_date(expiry),
         nationality: strip(nationality),
         # Not the holder's number in every case (see the moduledoc).
         personal_number: nil
       }}
    end
  end

  # An empty personal number may use "<" or "0" as its check digit.
  defp check_personal(personal, check) do
    if strip(personal) == "" and check in ["<", "0"], do: :ok, else: check(personal, check)
  end

  # Spanish identity cards carry the DNI/NIE number in the optional data. It is
  # only used when it is a well-formed DNI or NIE with a valid control letter.
  defp personal_number("ESP", optional1, optional2) do
    [optional1, optional2]
    |> Enum.flat_map(&String.split(&1, "<", trim: true))
    |> Enum.find(&valid_spanish_id?/1)
  end

  defp personal_number(_state, _optional1, _optional2), do: nil

  @control_letters "TRWAGMYFPDXBNJZSQVHLCKE"

  @doc "True for a DNI (8 digits + letter) or NIE (X/Y/Z + 7 digits + letter) with a valid letter."
  def valid_spanish_id?(<<prefix, digits::binary-7, letter>>) when prefix in ~c"XYZ" do
    valid_spanish_id?(<<prefix - ?X + ?0>> <> digits <> <<letter>>)
  end

  def valid_spanish_id?(<<digits::binary-8, letter>>) do
    case Integer.parse(digits) do
      {number, ""} -> String.at(@control_letters, rem(number, 23)) == <<letter>>
      _ -> false
    end
  end

  def valid_spanish_id?(_value), do: false

  @doc "ICAO 9303 check digit (weights 7, 3, 1)."
  @spec check_digit(binary()) :: non_neg_integer()
  def check_digit(data) do
    data
    |> :binary.bin_to_list()
    |> Enum.with_index()
    |> Enum.reduce(0, fn {char, index}, acc ->
      acc + value(char) * Enum.at([7, 3, 1], rem(index, 3))
    end)
    |> rem(10)
  end

  defp value(char) when char in ?0..?9, do: char - ?0
  defp value(char) when char in ?A..?Z, do: char - ?A + 10
  defp value(?<), do: 0

  defp check(data, <<digit>>) when digit in ?0..?9 do
    if check_digit(data) == digit - ?0, do: :ok, else: {:error, :invalid_check_digit}
  end

  defp check(_data, _check), do: {:error, :invalid_check_digit}

  # Unknown day or month ("<<") is resolved to the latest possible date, so an
  # incomplete birth date can only make someone look younger, never older. The
  # century is chosen with the earliest possible date (a latest date in the
  # future must not roll a child back a hundred years); if the latest possible
  # date is still in the future, the holder counts as born today.
  defp birth_date(<<yy::binary-2, mm::binary-2, dd::binary-2>>, today) do
    with {two_digits, ""} <- Integer.parse(yy),
         {:ok, month_range} <- component(mm, 1..12),
         {:ok, day_range} <- component(dd, 1..31) do
      year = if 2000 + two_digits > today.year, do: 1900 + two_digits, else: 2000 + two_digits

      with {:ok, earliest} <- date(year, month_range.first, day_range.first) do
        year = if Date.compare(earliest, today) == :gt, do: year - 100, else: year
        day = if dd == "<<", do: :last, else: day_range.first

        with {:ok, latest} <- date(year, month_range.last, day),
             :ok <- plausible(latest, today) do
          {:ok, if(Date.compare(latest, today) == :gt, do: today, else: latest)}
        end
      end
    else
      _ -> {:error, :malformed_dg1}
    end
  end

  defp component("<<", range), do: {:ok, range}

  defp component(value, range) do
    case Integer.parse(value) do
      {int, ""} -> if int in range, do: {:ok, int..int}, else: :error
      _ -> :error
    end
  end

  # Nobody holding a valid document is 120 or older.
  defp plausible(date, today) do
    if age(date, today) < 120, do: :ok, else: {:error, :malformed_dg1}
  end

  defp date(year, month, :last) when is_integer(month) and month in 1..12,
    do: {:ok, Date.new!(year, month, 1) |> Date.end_of_month()}

  defp date(year, month, day) when is_integer(month) and is_integer(day) do
    case Date.new(year, month, day) do
      {:ok, date} -> {:ok, date}
      _ -> {:error, :malformed_dg1}
    end
  end

  defp date(_year, _month, _day), do: {:error, :malformed_dg1}

  # Two-digit expiry years are always 20YY. An expiry that is not a date (e.g.
  # documents without expiry) is `nil`, not a parsing error.
  defp expiry_date(<<yy::binary-2, mm::binary-2, dd::binary-2>>) do
    with {year, ""} <- Integer.parse(yy),
         {month, ""} <- Integer.parse(mm),
         {day, ""} <- Integer.parse(dd),
         {:ok, date} <- Date.new(2000 + year, month, day) do
      date
    else
      _ -> nil
    end
  end

  defp strip(value),
    do: value |> String.trim_trailing("<") |> String.replace("<", " ") |> String.trim()

  @doc "Age in completed years on `today` (a 29 February birthday counts from 1 March)."
  @spec age(Date.t(), Date.t()) :: integer()
  def age(%Date{} = birth, %Date{} = today) do
    years = today.year - birth.year
    birthday = anniversary(birth, today.year)
    if Date.compare(today, birthday) == :lt, do: years - 1, else: years
  end

  defp anniversary(%Date{month: 2, day: 29}, year) do
    if Calendar.ISO.leap_year?(year), do: Date.new!(year, 2, 29), else: Date.new!(year, 3, 1)
  end

  defp anniversary(%Date{month: month, day: day}, year), do: Date.new!(year, month, day)
end
