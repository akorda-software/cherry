defmodule Cherry.Repo.Migrations.AllowDraftProfiles do
  use Ecto.Migration

  def up do
    alter table(:profiles) do
      modify(:display_name, :string, null: true)
      modify(:birth_date, :date, null: true)
      modify(:gender, :string, null: true)
      modify(:what_i_am_looking_for, :string, null: true)
      modify(:bio, :text, null: true)
    end
  end

  def down do
    alter table(:profiles) do
      modify(:display_name, :string, null: false)
      modify(:birth_date, :date, null: false)
      modify(:gender, :string, null: false)
      modify(:what_i_am_looking_for, :string, null: false)
      modify(:bio, :text, null: false)
    end
  end
end
