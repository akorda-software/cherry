defmodule CherryWeb.BackofficeAccountController do
  use CherryWeb, :controller
  alias Cherry.Backoffice.{Access, LoginThrottle, Security}
  alias CherryWeb.Plugs.BackofficeSession
  plug(:put_layout, false)
  plug(:put_root_layout, false)
  plug(:put_view, html: CherryWeb.BackofficeHTML)
  plug(:require_staff)

  defp require_staff(conn, opts), do: BackofficeSession.require_staff(conn, opts)
  def show(conn, _), do: account(conn, nil)

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
        |> account(
          "Comprueba la contraseña actual y elige otra de al menos 16 caracteres (máximo 256 bytes). Si has repetido intentos, espera quince minutos."
        )
    end
  end

  def revoke_sessions(conn, _) do
    message =
      case Access.revoke_other_sessions(conn.assigns.current_staff, BackofficeSession.token(conn)) do
        {:ok, 0} -> {:info, "No tenías otras sesiones abiertas."}
        {:ok, 1} -> {:info, "Hemos cerrado tu otra sesión. Esta sigue abierta."}
        {:ok, n} -> {:info, "Hemos cerrado tus otras #{n} sesiones. Esta sigue abierta."}
        _ -> {:error, "No hemos podido cerrar las sesiones. Vuelve a entrar y repítelo."}
      end

    conn |> put_flash(elem(message, 0), elem(message, 1)) |> redirect(to: ~p"/backoffice/account")
  end

  defp account(conn, error) do
    render(conn, :account,
      error: error,
      sessions: Access.sessions(conn.assigns.current_staff, BackofficeSession.token(conn))
    )
  end
end
