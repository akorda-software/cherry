defmodule Cherry.Repo.Migrations.RequireBootstrapPasswordChange do
  use Ecto.Migration

  def change do
    alter table(:backoffice_staff) do
      add(:password_change_required, :boolean, null: false, default: false)
    end
  end
end
