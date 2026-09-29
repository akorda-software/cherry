defmodule Snack.Dating.Message do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Conversation
  alias Snack.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "messages" do
    # Cifrado en reposo (D-2026-08-21): en memoria es texto claro,
    # en disco se guarda cifrado vía Snack.Crypto.Encrypted.
    field(:body, Snack.Crypto.Encrypted)

    belongs_to(:conversation, Conversation)
    belongs_to(:sender_profile, Profile, foreign_key: :sender_profile_id)

    # Microsegundos: el orden de la conversación depende de ello (D-2026-09-29).
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:body, :conversation_id, :sender_profile_id])
    |> validate_required([:body, :conversation_id, :sender_profile_id])
    |> validate_length(:body, min: 1, max: 2000)
    |> foreign_key_constraint(:conversation_id)
    |> foreign_key_constraint(:sender_profile_id)
  end
end
