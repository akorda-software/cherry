defmodule Cherry.Casework.Audit do
  @moduledoc "Append-only application audit. Never put evidence, messages or credentials in metadata."
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "casework_audit" do
    field(:case_id, :binary_id)
    field(:staff_id, :binary_id)
    field(:user_id, :binary_id)
    field(:action, :string)
    field(:metadata, :map, default: %{})
    timestamps(type: :utc_datetime, updated_at: false)
  end

  def record!(action, attrs \\ %{}) do
    %__MODULE__{}
    |> Ecto.Changeset.change(Map.put(attrs, :action, action))
    |> Cherry.Repo.insert!()
  end
end
