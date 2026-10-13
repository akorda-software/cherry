defmodule Cherry.Identity.Document.Der do
  @moduledoc """
  Minimal DER/BER reader for the eMRTD structures of ICAO 9303 (EF.SOD, CMS
  SignedData, LDSSecurityObject, DG1).

  Only what passive authentication needs: tag-length-value splitting (definite
  and, for robustness, indefinite lengths), OIDs and integers. X.509
  certificates are decoded with `:public_key`, not here.

  A decoded element is `{tag, value, raw}`: `tag` is `{class, constructed?,
  number}`, `value` the content octets and `raw` the full encoding (needed to
  verify signatures over the exact bytes received).
  """

  import Bitwise

  @type class :: :universal | :application | :context | :private
  @type tag :: {class(), boolean(), non_neg_integer()}
  @type element :: {tag(), binary(), binary()}

  # Bound recursion and allocation on attacker-controlled input.
  @max_depth 32

  @doc "Decodes exactly one element; trailing bytes are an error."
  @spec decode(binary()) :: {:ok, element()} | {:error, :malformed}
  def decode(bin) when is_binary(bin) do
    case decode_one(bin, 0) do
      {:ok, element, ""} -> {:ok, element}
      _other -> {:error, :malformed}
    end
  end

  @doc "Decodes the first element and returns the remaining bytes."
  @spec decode_prefix(binary()) :: {:ok, element(), binary()} | {:error, :malformed}
  def decode_prefix(bin) when is_binary(bin), do: decode_one(bin, 0)

  @doc "Splits the content of a constructed element into its children."
  @spec children(element() | binary()) :: {:ok, [element()]} | {:error, :malformed}
  def children({{_class, true, _number}, value, _raw}), do: children(value)
  def children({{_class, false, _number}, _value, _raw}), do: {:error, :malformed}

  def children(bin) when is_binary(bin), do: collect(bin, [])

  defp collect("", acc), do: {:ok, Enum.reverse(acc)}

  defp collect(bin, acc) do
    case decode_one(bin, 0) do
      {:ok, element, rest} -> collect(rest, [element | acc])
      {:error, _} = error -> error
    end
  end

  @doc "Decodes an OBJECT IDENTIFIER element into dotted notation."
  @spec oid(element()) :: {:ok, String.t()} | {:error, :malformed}
  # Real OIDs are a few dozen bytes; the bound keeps decoding linear.
  def oid({{:universal, false, 6}, value, _raw}) when byte_size(value) in 1..64 do
    with {:ok, [first | rest]} <- base128(value, 0, []) do
      {a, b} =
        cond do
          first < 40 -> {0, first}
          first < 80 -> {1, first - 40}
          true -> {2, first - 80}
        end

      {:ok, Enum.map_join([a, b | rest], ".", &Integer.to_string/1)}
    end
  end

  def oid(_element), do: {:error, :malformed}

  defp base128(<<>>, 0, acc), do: {:ok, Enum.reverse(acc)}
  defp base128(<<>>, _partial, _acc), do: {:error, :malformed}

  defp base128(<<1::1, bits::7, rest::binary>>, partial, acc) when partial < 0xFFFFFFFFFFFF,
    do: base128(rest, partial <<< 7 ||| bits, acc)

  defp base128(<<1::1, _bits::7, _rest::binary>>, _partial, _acc), do: {:error, :malformed}

  defp base128(<<0::1, bits::7, rest::binary>>, partial, acc),
    do: base128(rest, 0, [partial <<< 7 ||| bits | acc])

  @doc "Decodes an INTEGER element (two's complement)."
  @spec integer(element()) :: {:ok, integer()} | {:error, :malformed}
  def integer({{:universal, false, 2}, value, _raw}) when byte_size(value) > 0 do
    size = bit_size(value)
    <<int::signed-size(size)>> = value
    {:ok, int}
  end

  def integer(_element), do: {:error, :malformed}

  @doc "Content of an OCTET STRING element."
  @spec octet_string(element()) :: {:ok, binary()} | {:error, :malformed}
  def octet_string({{:universal, false, 4}, value, _raw}), do: {:ok, value}

  # BER constructed OCTET STRING (chunks), seen in some CMS encoders.
  def octet_string({{:universal, true, 4}, value, _raw}) do
    with {:ok, parts} <- children(value) do
      Enum.reduce_while(parts, {:ok, ""}, fn part, {:ok, acc} ->
        case octet_string(part) do
          {:ok, chunk} -> {:cont, {:ok, acc <> chunk}}
          error -> {:halt, error}
        end
      end)
    end
  end

  def octet_string(_element), do: {:error, :malformed}

  # ── TLV ──────────────────────────────────────────────────────────────

  defp decode_one(_bin, depth) when depth > @max_depth, do: {:error, :malformed}

  defp decode_one(bin, depth) do
    with {:ok, tag, after_tag} <- read_tag(bin),
         {:ok, length, after_len} <- read_length(after_tag) do
      header_size = byte_size(bin) - byte_size(after_len)

      case length do
        :indefinite ->
          {_class, constructed?, _number} = tag

          if constructed? do
            read_indefinite(bin, tag, after_len, header_size, depth)
          else
            {:error, :malformed}
          end

        length when byte_size(after_len) >= length ->
          <<value::binary-size(length), rest::binary>> = after_len
          raw = binary_part(bin, 0, header_size + length)
          {:ok, {tag, value, raw}, rest}

        _too_long ->
          {:error, :malformed}
      end
    end
  end

  # Indefinite length: children until the end-of-contents octets (00 00).
  defp read_indefinite(bin, tag, content, header_size, depth) do
    case scan_eoc(content, 0, depth) do
      {:ok, content_size} ->
        value = binary_part(content, 0, content_size)
        total = header_size + content_size + 2
        raw = binary_part(bin, 0, total)
        rest = binary_part(bin, total, byte_size(bin) - total)
        {:ok, {tag, value, raw}, rest}

      error ->
        error
    end
  end

  defp scan_eoc(<<0, 0, _rest::binary>>, offset, _depth), do: {:ok, offset}

  defp scan_eoc(bin, offset, depth) when byte_size(bin) > 0 do
    case decode_one(bin, depth + 1) do
      {:ok, {_tag, _value, raw}, rest} -> scan_eoc(rest, offset + byte_size(raw), depth)
      error -> error
    end
  end

  defp scan_eoc(_bin, _offset, _depth), do: {:error, :malformed}

  defp read_tag(<<class::2, constructed::1, 0b11111::5, rest::binary>>) do
    case base128_tag(rest, 0) do
      {:ok, number, rest} -> {:ok, {class(class), constructed == 1, number}, rest}
      error -> error
    end
  end

  defp read_tag(<<class::2, constructed::1, number::5, rest::binary>>),
    do: {:ok, {class(class), constructed == 1, number}, rest}

  defp read_tag(_bin), do: {:error, :malformed}

  defp base128_tag(<<1::1, bits::7, rest::binary>>, acc) when acc < 0xFFFFFF,
    do: base128_tag(rest, acc <<< 7 ||| bits)

  defp base128_tag(<<0::1, bits::7, rest::binary>>, acc), do: {:ok, acc <<< 7 ||| bits, rest}
  defp base128_tag(_bin, _acc), do: {:error, :malformed}

  defp read_length(<<0::1, length::7, rest::binary>>), do: {:ok, length, rest}
  defp read_length(<<0x80, rest::binary>>), do: {:ok, :indefinite, rest}

  defp read_length(<<1::1, count::7, rest::binary>>) when count in 1..4 do
    case rest do
      <<length::unsigned-size(count * 8), rest::binary>> -> {:ok, length, rest}
      _short -> {:error, :malformed}
    end
  end

  defp read_length(_bin), do: {:error, :malformed}

  defp class(0), do: :universal
  defp class(1), do: :application
  defp class(2), do: :context
  defp class(3), do: :private
end
