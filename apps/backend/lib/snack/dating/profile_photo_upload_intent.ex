defmodule Snack.Dating.ProfilePhotoUploadIntent do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "profile_photo_upload_intents" do
    field(:storage_key, :string)
    field(:public_url, :string)
    field(:position, :integer)
    field(:content_type, :string)
    field(:size_bytes, :integer)
    field(:expires_at, :utc_datetime)
    field(:completed_at, :utc_datetime)
    # Stored object(s) physically deleted (Snack.Dating.PhotoStorage).
    field(:storage_deleted_at, :utc_datetime)

    belongs_to(:profile, Profile)

    timestamps(type: :utc_datetime)
  end

  def changeset(intent, attrs, opts \\ []) do
    max_upload_bytes = Keyword.get(opts, :max_upload_bytes, 2_000_000)

    allowed_content_types =
      Keyword.get(opts, :allowed_content_types, ["image/jpeg", "image/png", "image/webp"])

    intent
    |> cast(attrs, [
      :profile_id,
      :storage_key,
      :public_url,
      :position,
      :content_type,
      :size_bytes,
      :expires_at,
      :completed_at
    ])
    |> validate_required([
      :profile_id,
      :storage_key,
      :public_url,
      :position,
      :content_type,
      :size_bytes,
      :expires_at
    ])
    |> validate_number(:position, greater_than_or_equal_to: 1, less_than_or_equal_to: 4)
    |> validate_number(:size_bytes, greater_than: 0, less_than_or_equal_to: max_upload_bytes)
    |> validate_inclusion(:content_type, allowed_content_types)
    |> foreign_key_constraint(:profile_id)
    |> unique_constraint(:storage_key)
  end

  def complete_changeset(intent, attrs) do
    intent
    |> cast(attrs, [:completed_at])
    |> validate_required([:completed_at])
  end
end
