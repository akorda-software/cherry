defmodule Cherry.Release do
  @moduledoc """
  Tareas de BD de un release (sin Mix): `bin/migrate` y `bin/seed`.

  `migrate/0` aplica las migraciones y después sincroniza el catálogo cerrado de
  etiquetas (`seed/0`): una instalación nueva (Docker o release) nunca arranca
  con el catálogo vacío, que impediría completar el onboarding. Nunca ejecuta
  los datos de demo (`priv/repo/demo_seeds.exs`, solo dev).
  """
  @app :cherry

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end

    seed()
  end

  @doc "Sincroniza el catálogo de etiquetas (idempotente; `Cherry.Dating.TagCatalog.seed!/0`)."
  def seed do
    load_app()

    {:ok, %{tags: tags, deactivated: deactivated}, _} =
      Ecto.Migrator.with_repo(Cherry.Repo, fn _repo -> Cherry.Dating.TagCatalog.seed!() end)

    IO.puts("Tag catalog: #{tags} tags (deactivated #{deactivated} legacy tags).")
    :ok
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  @doc "One-time owner bootstrap; reads a mounted private file, never prints credentials."
  def bootstrap_backoffice do
    load_app()
    email = System.fetch_env!("CHERRY_BACKOFFICE_EMAIL")
    path = System.fetch_env!("CHERRY_BACKOFFICE_PASSWORD_FILE")
    if String.trim(email) == "", do: raise("CHERRY_BACKOFFICE_EMAIL is empty")
    stat = File.lstat!(path)

    unless Path.type(path) == :absolute and stat.type == :regular and
             Bitwise.band(stat.mode, 0o777) in [0o600, 0o400] do
      raise "password file must be an absolute private regular file (0600/0400)"
    end

    password = path |> File.read!() |> String.trim_trailing("\n")

    case Ecto.Migrator.with_repo(Cherry.Repo, fn _ ->
           Cherry.Backoffice.Security.bootstrap(email, password)
         end) do
      {:ok, {:ok, _staff}, _} ->
        IO.puts("Owner provisioned; personal password change required at first login.")

      {:ok, {:error, :already_bootstrapped}, _} ->
        raise "an active owner already exists; use the documented recovery process"

      _ ->
        raise "owner bootstrap failed; check identity and password requirements without printing credentials"
    end
  end

  @doc "Offline only: reapply erasures, invalidate sessions, reconcile photos."
  def recover do
    load_app()
    Application.ensure_all_started(:req)
    {:ok, :ok, _} = Ecto.Migrator.with_repo(Cherry.Repo, fn _ -> Cherry.Recovery.prepare!() end)

    IO.puts(
      "Database prepared; DO NOT REOPEN before storage reconciliation and staff access review."
    )
  end

  def reconcile_storage do
    load_app()
    Application.ensure_all_started(:req)

    {:ok, :ok, _} =
      Ecto.Migrator.with_repo(Cherry.Repo, fn _ -> Cherry.Recovery.reconcile_storage!() end)

    IO.puts("Storage reconciled; review staff roles/access before reopening. No gallery reset.")
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
