defmodule Cherry.Repo.Migrations.CreateBackofficeCasework do
  use Ecto.Migration

  def change do
    create table(:backoffice_staff, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:email, :string, null: false)
      add(:role, :string, null: false)
      add(:disabled_at, :utc_datetime)
      timestamps(type: :utc_datetime)
    end

    create(unique_index(:backoffice_staff, [:email]))

    create(
      constraint(:backoffice_staff, :staff_role,
        check: "role IN ('admin', 'moderator', 'privacy')"
      )
    )

    create table(:backoffice_credentials, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:staff_id, references(:backoffice_staff, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:token_hash, :binary, null: false)
      add(:kind, :string, null: false)
      add(:expires_at, :utc_datetime, null: false)
      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:backoffice_credentials, [:token_hash]))
    create(index(:backoffice_credentials, [:staff_id, :kind]))
    create(index(:backoffice_credentials, [:expires_at]))

    create table(:casework_cases, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:kind, :string, null: false)
      add(:category, :string, null: false)
      add(:statement, :text)
      add(:status, :string, null: false, default: "open")
      add(:requester_user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:subject_user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:report_id, references(:reports, type: :binary_id, on_delete: :nilify_all))
      add(:parent_case_id, references(:casework_cases, type: :binary_id, on_delete: :nilify_all))

      add(
        :assigned_staff_id,
        references(:backoffice_staff, type: :binary_id, on_delete: :nilify_all)
      )

      add(
        :decided_by_staff_id,
        references(:backoffice_staff, type: :binary_id, on_delete: :nilify_all)
      )

      add(:outcome, :string)
      add(:response, :text)
      add(:reporter_response, :text)
      add(:resolved_at, :utc_datetime)
      timestamps(type: :utc_datetime)
    end

    create(unique_index(:casework_cases, [:report_id]))

    create(
      unique_index(:casework_cases, [:parent_case_id, :requester_user_id],
        where: "kind = 'appeal'"
      )
    )

    create(index(:casework_cases, [:status, :kind, :inserted_at, :id]))
    create(index(:casework_cases, [:requester_user_id, :inserted_at]))
    create(index(:casework_cases, [:subject_user_id]))

    create(
      constraint(:casework_cases, :case_kind,
        check: "kind IN ('report', 'complaint', 'privacy', 'appeal')"
      )
    )

    create(constraint(:casework_cases, :case_status, check: "status IN ('open', 'resolved')"))

    create table(:casework_notices, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:case_id, references(:casework_cases, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:message, :text, null: false)
      add(:event, :string, null: false)
      add(:read_at, :utc_datetime)
      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:casework_notices, [:case_id, :user_id, :event]))
    create(index(:casework_notices, [:user_id, :inserted_at, :id]))

    create table(:casework_audit, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:case_id, references(:casework_cases, type: :binary_id, on_delete: :nilify_all))
      add(:staff_id, references(:backoffice_staff, type: :binary_id, on_delete: :nilify_all))
      add(:user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:action, :string, null: false)
      add(:metadata, :map, null: false, default: %{})
      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(index(:casework_audit, [:case_id, :inserted_at, :id]))

    alter table(:users) do
      add(:suspended_at, :utc_datetime)

      add(
        :suspension_case_id,
        references(:casework_cases, type: :binary_id, on_delete: :nilify_all)
      )
    end

    # Import only unresolved legacy reports; don't invent a reason for old decisions.
    execute(
      """
      INSERT INTO casework_cases
        (id, kind, category, statement, requester_user_id, subject_user_id, report_id, status, inserted_at, updated_at)
      SELECT uuid_generate_v4(), 'report', r.reason, r.details, a.user_id, b.user_id, r.id, 'open', r.inserted_at, r.updated_at
      FROM reports r JOIN profiles a ON a.id = r.reporter_profile_id
      JOIN profiles b ON b.id = r.target_profile_id WHERE r.status = 'open'
      """,
      "DELETE FROM casework_cases WHERE report_id IS NOT NULL"
    )
  end
end
