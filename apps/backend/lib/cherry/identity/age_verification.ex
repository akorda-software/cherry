defmodule Cherry.Identity.AgeVerification do
  @moduledoc """
  "Adult: yes" for a user (D-2026-10-09). Only status, method, date and the
  keyed document fingerprint; nothing read from the document is stored.

  Methods: `nfc_dni` (identity card read by NFC: the DNI or a foreign one;
  residence permits such as the TIE only where the instance accepts them),
  `nfc_passport`, `provider` (external fallback) and `eu_wallet` (EU age
  verification app). Only the NFC ones exist today.
  """
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @type t :: %__MODULE__{}

  @statuses ~w(verified revoked)
  @methods ~w(nfc_dni nfc_passport provider eu_wallet)

  schema "age_verifications" do
    field(:status, :string)
    field(:method, :string)
    field(:verified_at, :utc_datetime)
    field(:document_fingerprint, :binary, redact: true)

    belongs_to(:user, Cherry.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  def statuses, do: @statuses
  def methods, do: @methods

  def changeset(verification, attrs) do
    verification
    |> cast(attrs, [:status, :method, :verified_at, :document_fingerprint, :user_id])
    |> validate_required([:status, :method, :verified_at, :user_id])
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:method, @methods)
    |> unique_constraint(:user_id)
    |> unique_constraint(:document_fingerprint)
    |> check_constraint(:status, name: :status_valid)
    |> check_constraint(:method, name: :method_valid)
    |> foreign_key_constraint(:user_id)
  end
end
