defmodule Cherry.Casework.Note do
  @moduledoc "Internal staff note on a case. Never delivered to users; erased with its case."
  use Ecto.Schema
  import Ecto.Changeset
  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "casework_notes" do
    field(:case_id, :binary_id)
    field(:staff_id, :binary_id)
    field(:body, :string, redact: true)
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def changeset(note, attrs) do
    note
    |> cast(attrs, [:body])
    |> update_change(:body, &String.trim/1)
    |> validate_required([:body])
    |> validate_length(:body, min: 3, max: 2000)
  end
end
