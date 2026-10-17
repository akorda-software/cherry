defmodule Cherry.Backoffice.LoginAttempt do
  @moduledoc false
  use Ecto.Schema
  @primary_key {:key, :binary, autogenerate: false}
  schema "backoffice_login_attempts" do
    field(:attempts, :integer)
    field(:expires_at, :utc_datetime)
  end
end
