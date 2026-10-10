defmodule Cherry.Sessions.PushToken do
  use Ecto.Schema

  import Ecto.Changeset

  alias Cherry.Accounts.User
  alias Cherry.Sessions.Device
  alias Cherry.Sessions.SessionFamily

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @platforms ["ios", "android"]
  @statuses ["active", "inactive"]

  schema "push_tokens" do
    field(:expo_push_token, :string)
    field(:platform, :string)
    field(:installation_id, :string)
    field(:status, :string, default: "active")
    field(:last_seen_at, :utc_datetime)
    field(:disabled_at, :utc_datetime)

    belongs_to(:user, User)
    belongs_to(:device, Device)
    belongs_to(:session_family, SessionFamily)

    timestamps(type: :utc_datetime)
  end

  def changeset(push_token, attrs) do
    push_token
    |> cast(attrs, [
      :expo_push_token,
      :platform,
      :installation_id,
      :status,
      :last_seen_at,
      :disabled_at,
      :user_id,
      :device_id,
      :session_family_id
    ])
    |> validate_required([
      :expo_push_token,
      :platform,
      :installation_id,
      :status,
      :last_seen_at,
      :user_id,
      :device_id,
      :session_family_id
    ])
    |> validate_inclusion(:platform, @platforms)
    |> validate_inclusion(:status, @statuses)
    |> validate_expo_push_token()
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:device_id)
    |> foreign_key_constraint(:session_family_id)
    |> unique_constraint(:session_family_id)
  end

  defp validate_expo_push_token(changeset) do
    validate_change(changeset, :expo_push_token, fn :expo_push_token, token ->
      if String.match?(token, ~r/\A(ExponentPushToken|ExpoPushToken)\[[^\]]+\]\z/) do
        []
      else
        [expo_push_token: "must be a valid Expo push token"]
      end
    end)
  end
end
