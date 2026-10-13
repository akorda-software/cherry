defmodule Cherry.Dating.Tag do
  use Ecto.Schema

  import Ecto.Changeset

  alias Cherry.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "tags" do
    field(:slug, :string)
    field(:label, :string)
    field(:category, :string)
    field(:is_active, :boolean, default: true)
    field(:sort_order, :integer, default: 0)
    field(:emoji, :string)

    many_to_many(:profiles, Profile, join_through: "profile_tags")

    timestamps(type: :utc_datetime)
  end

  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:slug, :label, :category, :is_active, :sort_order, :emoji])
    |> validate_required([:slug, :label, :category])
    |> validate_length(:emoji, max: 16)
    |> unique_constraint(:slug)
  end
end
