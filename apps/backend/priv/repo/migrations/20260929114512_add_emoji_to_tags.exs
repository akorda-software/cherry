defmodule Cherry.Repo.Migrations.AddEmojiToTags do
  use Ecto.Migration

  # Catálogo de etiquetas con emoji (2026-09-29). Nullable: el seed del catálogo
  # lo rellena y el cliente tolera `null`.
  def change do
    alter table(:tags) do
      add(:emoji, :string)
    end
  end
end
