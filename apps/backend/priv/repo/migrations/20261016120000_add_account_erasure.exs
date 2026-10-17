defmodule Cherry.Repo.Migrations.AddAccountErasure do
  use Ecto.Migration

  def up do
    create table(:erasure_tasks, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:kind, :string, null: false)
      add(:reference, :text, null: false)
      add(:not_before, :utc_datetime, null: false)
      add(:finalize_after, :utc_datetime, null: false)
      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:erasure_tasks, [:kind, :reference]))
    create(index(:erasure_tasks, [:not_before]))

    create table(:verification_provider_sessions, primary_key: false) do
      add(:id, :string, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(index(:verification_provider_sessions, [:user_id]))

    for {table, column, target} <- cascading_references() do
      drop(constraint(table, "#{table}_#{column}_fkey"))

      alter table(table) do
        modify(column, references(target, type: :binary_id, on_delete: :delete_all))
      end
    end
  end

  def down do
    for {table, column, target} <- cascading_references() do
      drop(constraint(table, "#{table}_#{column}_fkey"))

      alter table(table) do
        modify(column, references(target, type: :binary_id, on_delete: :nilify_all))
      end
    end

    drop(table(:verification_provider_sessions))
    drop(table(:erasure_tasks))
  end

  defp cascading_references do
    [
      {:casework_cases, :requester_user_id, :users},
      {:casework_cases, :subject_user_id, :users},
      {:casework_cases, :parent_case_id, :casework_cases},
      {:casework_audit, :case_id, :casework_cases},
      {:casework_audit, :user_id, :users}
    ]
  end
end
