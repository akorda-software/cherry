defmodule Snack.Repo.Migrations.ProfilesLookingForArray do
  @moduledoc """
  «¿Qué buscas?» pasa de una sola intención a varias (1–4):
  `what_i_am_looking_for varchar` → `looking_for text[]`.

  Cada valor existente pasa a una lista de un elemento; los borradores sin
  contestar siguen en NULL (semántica de 20260429100000_allow_draft_profiles).
  El índice btree se sustituye por uno GIN, que sirve al filtro `&&` de
  discovery.
  """
  use Ecto.Migration

  def up do
    drop_if_exists(index(:profiles, [:what_i_am_looking_for]))

    execute("""
    ALTER TABLE profiles
      ALTER COLUMN what_i_am_looking_for TYPE text[]
      USING CASE WHEN what_i_am_looking_for IS NULL THEN NULL
                 ELSE ARRAY[what_i_am_looking_for::text] END
    """)

    rename(table(:profiles), :what_i_am_looking_for, to: :looking_for)

    create(index(:profiles, [:looking_for], using: :gin))
  end

  def down do
    drop_if_exists(index(:profiles, [:looking_for]))

    rename(table(:profiles), :looking_for, to: :what_i_am_looking_for)

    # Lossy: keeps the first intent of each list.
    execute("""
    ALTER TABLE profiles
      ALTER COLUMN what_i_am_looking_for TYPE varchar(255)
      USING what_i_am_looking_for[1]
    """)

    create(index(:profiles, [:what_i_am_looking_for]))
  end
end
