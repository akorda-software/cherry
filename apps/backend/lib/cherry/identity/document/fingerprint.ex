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
    compute_fields(
      mrz.issuing_state,
      String.first(mrz.document_code),
      mrz.document_number,
      mrz.personal_number
    )
  end

  @doc """
  Fingerprint from the fields of a document, for methods that do not read the
  MRZ (an external provider). Gives the same value as `compute/1` for the same
  document, so one document is one account whatever the method:

    * `issuing_state`: ICAO code of the issuing state (`"ESP"`).
    * `code_letter`: first letter of the MRZ document code (`"I"` identity
      cards and residence permits, `"P"` passports).
    * `document_number`: number of the document, MRZ characters only.
    * `personal_number`: the holder's DNI/NIE when `issuing_state` is `"ESP"`
      (a valid one, see `Mrz.valid_spanish_id?/1`), else `nil`.
  """
  @spec compute_fields(String.t(), String.t(), String.t(), String.t() | nil) ::
          {:ok, binary()} | {:error, :not_configured}
  def compute_fields(issuing_state, code_letter, document_number, personal_number) do
    case key() do
      nil ->
        {:error, :not_configured}

      key ->
        {:ok,
         :crypto.mac(
           :hmac,
           :sha256,
           key,
           input(issuing_state, code_letter, document_number, personal_number)
         )}
    end
  end

  @doc false
  def input(%Mrz{} = mrz),
    do:
      input(
        mrz.issuing_state,
        String.first(mrz.document_code),
        mrz.document_number,
        mrz.personal_number
      )

  # Only Spanish identity cards set a personal number (`Mrz` never sets it for
  # passports), so the DNI/NIE case needs no check of the document code.
  defp input("ESP", _code_letter, _number, personal) when is_binary(personal),
    do: "v1|ESP|ID|" <> personal

  defp input(state, code_letter, number, _personal),
    do: "v1|" <> state <> "|" <> code_letter <> "|" <> number

  @doc "True when a fingerprint key is configured."
  def configured?, do: key() != nil

  defp key do
    case Application.get_env(:cherry, :age_verification, [])[:fingerprint_key] do
      key when is_binary(key) and key != "" -> key
      _ -> nil
    end
  end
end
