defmodule Snack.Dating.Conversation do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Match
  alias Snack.Dating.Message

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "conversations" do
    belongs_to(:match, Match)
    has_many(:messages, Message)

    timestamps(type: :utc_datetime)
  end

  def changeset(conversation, attrs) do
    conversation
    |> cast(attrs, [:match_id])
    |> validate_required([:match_id])
    |> foreign_key_constraint(:match_id)
    |> unique_constraint(:match_id)
  end
end
