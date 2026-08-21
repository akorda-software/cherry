defmodule Snack.Repo.Migrations.AddDiscoveryModeToDiscoveryPreferences do
  use Ecto.Migration

  def change do
    alter table(:discovery_preferences) do
      add(:discovery_mode, :string, null: false, default: "feed")
    end
  end
end
