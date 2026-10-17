defmodule CherryWeb.BackofficeAccountController do
  use CherryWeb, :controller
  alias Cherry.Backoffice.{LoginThrottle, Security}
  alias CherryWeb.Plugs.BackofficeSession
  plug(:put_layout, false)
  plug(:put_root_layout, false)
  plug(:put_view, html: CherryWeb.BackofficeHTML)
  plug(:require_staff)

  defp require_staff(conn, opts), do: BackofficeSession.require_staff(conn, opts)
  def show(conn, _), do: render(conn, :account, error: nil)

  def update(conn, params) do
    result =
      if LoginThrottle.allow?(conn.remote_ip),
        do:
          Security.change_password(
            conn.assigns.current_staff,
            params["current_password"],
            params["password"]
          ),
        else: {:error, :rate_limited}

    case result do
      {:ok, :ok} ->
        conn |> BackofficeSession.sign_out() |> redirect(to: ~p"/backoffice/login")

      _ ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:account,
          error:
            "Comprueba la contraseña actual y elige otra de al menos 16 caracteres (máximo 256 bytes). Si has repetido intentos, espera quince minutos."
        )
    end
  end
end
