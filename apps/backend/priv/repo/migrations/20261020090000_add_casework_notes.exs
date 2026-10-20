defmodule Cherry.Repo.Migrations.AddCaseworkNotes do
  use Ecto.Migration

  def change do
    # Internal staff notes. They live and die with their case: account erasure
    # cascades cases, so notes never outlive the record they describe.
    create table(:casework_notes, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:case_id, references(:casework_cases, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:staff_id, references(:backoffice_staff, type: :binary_id, on_delete: :nilify_all))
      add(:body, :text, null: false)
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(index(:casework_notes, [:case_id, :inserted_at]))

    # Panel activity log and per-person last access.
    create(index(:casework_audit, [:inserted_at, :id]))
    create(index(:casework_audit, [:staff_id, :action, :inserted_at]))
  end
end
