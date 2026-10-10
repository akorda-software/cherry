defmodule Cherry.Identity.Document.Fingerprint do
  @moduledoc """
  Keyed fingerprint of an identity document: one person, one account.

  HMAC-SHA256 with `DOCUMENT_FINGERPRINT_KEY` (config `:cherry, :age_verification,
  fingerprint_key`). Without the key the fingerprint cannot be recomputed from a
  document number, so a database leak does not reveal who is registered.

  Input, versioned so the scheme can change without mixing values:

    * Spanish identity cards (DNI, and TIE with NIE): `v1|ESP|ID|<DNI/NIE>`.
      The DNI number survives renewals and is the same in every card.
    * Any other document: `v1|<issuing state>|<code letter>|<document number>`.
      Passports change number on renewal (see `Mrz` for why their personal
      number field is not used).

  The key must never change: rotating it orphans every stored fingerprint
  (they could only be recomputed by reading each document again).
  """

  alias Cherry.Identity.Document.Mrz

  @doc "Fingerprint of the document, or `{:error, :not_configured}` without a key."
  @spec compute(Mrz.t()) :: {:ok, binary()} | {:error, :not_configured}
  def compute(%Mrz{} = mrz) do
    case key() do
      nil -> {:error, :not_configured}
      key -> {:ok, :crypto.mac(:hmac, :sha256, key, input(mrz))}
    end
  end

  @doc false
  def input(%Mrz{format: :td1, issuing_state: "ESP", personal_number: number})
      when is_binary(number),
      do: "v1|ESP|ID|" <> number

  def input(%Mrz{issuing_state: state, document_code: code, document_number: number}),
    do: "v1|" <> state <> "|" <> String.first(code) <> "|" <> number

  @doc "True when a fingerprint key is configured."
  def configured?, do: key() != nil

  defp key do
    case Application.get_env(:cherry, :age_verification, [])[:fingerprint_key] do
      key when is_binary(key) and key != "" -> key
      _ -> nil
    end
  end
end
