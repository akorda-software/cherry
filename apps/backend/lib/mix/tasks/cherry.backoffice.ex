defmodule Mix.Tasks.Cherry.Backoffice do
  use Mix.Task
  @shortdoc "Provision/disable staff or write a one-use login code to a private file"
  @moduledoc """
  Console only, no default administrators or passwords:

      mix cherry.backoffice grant EMAIL superadmin
      mix cherry.backoffice login EMAIL /absolute/private/path/code
      mix cherry.backoffice disable EMAIL

  Roles: superadmin, admin, moderator, privacy. Login codes expire in ten minutes. The
  command never prints credentials. Read the file yourself and paste the code
  into /backoffice/login, then remove the file. Never commit or share it.
  """
  def run(args) do
    Mix.Task.run("app.start")

    result =
      case args do
        ["grant", email, role] ->
          Cherry.Backoffice.Access.provision(email, role)

        ["login", email, path] ->
          Cherry.Backoffice.Access.issue_login_to_file(email, path)

        ["disable", email] ->
          Cherry.Backoffice.Access.disable(email)

        _ ->
          Mix.raise(
            "Usage: cherry.backoffice grant EMAIL ROLE | login EMAIL ABSOLUTE_FILE | disable EMAIL"
          )
      end

    case result do
      :ok ->
        Mix.shell().info("Código guardado en archivo privado. Caduca en diez minutos.")

      {:ok, _} ->
        Mix.shell().info("Acceso actualizado.")

      {:error, _} ->
        Mix.raise(
          "No se pudo completar la operación; comprueba cuenta, rol y archivo de destino."
        )
    end
  end
end
