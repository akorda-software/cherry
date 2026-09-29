defmodule Snack.Release do
  @moduledoc """
  Tareas de BD de un release (sin Mix): `bin/migrate` y `bin/seed`.

  `migrate/0` aplica las migraciones y después sincroniza el catálogo cerrado de
  etiquetas (`seed/0`): una instalación nueva (Docker o release) nunca arranca
  con el catálogo vacío, que impediría completar el onboarding. Nunca ejecuta
  los datos de demo (`priv/repo/demo_seeds.exs`, solo dev).
  """
  @app :snack

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end

    seed()
  end

  @doc "Sincroniza el catálogo de etiquetas (idempotente; `Snack.Dating.TagCatalog.seed!/0`)."
  def seed do
    load_app()

    {:ok, %{tags: tags, deactivated: deactivated}, _} =
      Ecto.Migrator.with_repo(Snack.Repo, fn _repo -> Snack.Dating.TagCatalog.seed!() end)

    IO.puts("Tag catalog: #{tags} tags (deactivated #{deactivated} legacy tags).")
    :ok
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    # Many platforms require SSL when connecting to the database
    Application.ensure_all_started(:ssl)
    Application.ensure_loaded(@app)
  end
end
