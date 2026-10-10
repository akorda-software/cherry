defmodule Cherry.Repo do
  use Ecto.Repo,
    otp_app: :cherry,
    adapter: Ecto.Adapters.Postgres,
    types: Cherry.PostgresTypes
end
