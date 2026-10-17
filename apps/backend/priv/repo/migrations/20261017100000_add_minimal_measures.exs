defmodule Cherry.Repo.Migrations.AddMinimalMeasures do
  use Ecto.Migration

  def up do
    drop(constraint(:casework_cases, :case_kind))

    create(
      constraint(:casework_cases, :case_kind,
        check: "kind IN ('report', 'complaint', 'privacy', 'appeal', 'measure')"
      )
    )
  end

  def down do
    # Never silently discard a live restriction or its review on rollback.
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM casework_cases WHERE kind = 'measure') THEN
        RAISE EXCEPTION 'minimal measures exist; migrate their review path before rollback';
      END IF;
    END $$;
    """)

    drop(constraint(:casework_cases, :case_kind))

    create(
      constraint(:casework_cases, :case_kind,
        check: "kind IN ('report', 'complaint', 'privacy', 'appeal')"
      )
    )
  end
end
