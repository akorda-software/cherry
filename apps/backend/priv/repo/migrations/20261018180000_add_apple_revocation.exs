defmodule Cherry.Repo.Migrations.AddAppleRevocation do
  use Ecto.Migration

  def change do
    alter table(:provider_identities) do
      # Application-encrypted before insertion. No Apple tokens in provider_data.
      add(:apple_revocation, :map, default: %{}, null: false)
    end
  end
end
