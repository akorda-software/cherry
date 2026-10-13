defmodule Cherry.Dating.ConversationRead do
  @moduledoc """
  Última lectura de una conversación por un participante (único por par).
  Los mensajes del otro perfil con `inserted_at > last_read_at` cuentan como no leídos.
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Cherry.Dating.Conversation
  alias Cherry.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "conversation_reads" do
    field(:last_read_at, :utc_datetime_usec)

    belongs_to(:conversation, Conversation)
    belongs_to(:profile, Profile)

    timestamps(type: :utc_datetime)
  end

  def changeset(read, attrs) do
    read
    |> cast(attrs, [:conversation_id, :profile_id, :last_read_at])
    |> validate_required([:conversation_id, :profile_id, :last_read_at])
    |> unique_constraint([:conversation_id, :profile_id])
    |> foreign_key_constraint(:conversation_id)
    |> foreign_key_constraint(:profile_id)
  end
end
