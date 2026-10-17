defmodule CherryWeb.BackofficeTeamController do
  use CherryWeb, :controller
  alias Cherry.Backoffice.Team
  alias CherryWeb.Plugs.BackofficeSession
  plug(:put_layout, false)
  plug(:put_root_layout, false)
  plug(:require_staff)

  defp require_staff(conn, opts), do: BackofficeSession.require_staff(conn, opts)

  def index(conn, params), do: listing(conn, params, nil)

  def create(conn, params) do
    case Team.invite(conn.assigns.current_staff, params) do
      {:ok, result} -> invitation(conn, result)
      error -> failure(conn, error)
    end
  end

  def update(conn, %{"id" => id} = params) do
    case Team.update(conn.assigns.current_staff, id, params) do
      {:ok, _} -> redirect(conn, to: ~p"/backoffice/team")
      error -> failure(conn, error)
    end
  end

  def reset_access(conn, %{"id" => id}) do
    case Team.reset_access(conn.assigns.current_staff, id) do
      {:ok, result} -> invitation(conn, result)
      error -> failure(conn, error)
    end
  end

  defp listing(conn, params, error) do
    offset = Cherry.Casework.offset(params)

    case Team.list(conn.assigns.current_staff, offset) do
      {:ok, staff} ->
        conn
        |> put_view(html: CherryWeb.BackofficeHTML)
        |> render(:team, staff: staff, error: error, offset: offset)

      _ ->
        conn |> put_status(:forbidden) |> text("Solo el superusuario puede gestionar el equipo.")
    end
  end

  defp invitation(conn, %{staff: staff, code: code}) do
    conn
    |> put_view(html: CherryWeb.BackofficeHTML)
    |> render(:invitation_created, invited_staff: staff, code: code)
  end

  defp failure(conn, {:error, :forbidden}),
    do: conn |> put_status(:forbidden) |> text("No tienes permiso para gestionar el equipo.")

  defp failure(conn, {:error, :not_found}),
    do: conn |> put_status(:not_found) |> text("Cuenta no encontrada.")

  defp failure(conn, {:error, :last_superadmin}),
    do:
      conn
      |> put_status(:conflict)
      |> listing(%{}, "Debe quedar al menos un superusuario activo.")

  defp failure(conn, _),
    do:
      conn
      |> put_status(:unprocessable_entity)
      |> listing(%{}, "Comprueba el correo y el rol. No se permiten correos duplicados.")
end
