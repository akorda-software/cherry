defmodule CherryWeb.BackofficeTeamController do
  use CherryWeb, :controller
  alias Cherry.Backoffice.Team
  alias Cherry.Casework
  alias CherryWeb.Plugs.BackofficeSession
  plug(:put_layout, false)
  plug(:put_root_layout, false)
  plug(:put_view, html: CherryWeb.BackofficeHTML)
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
      {:ok, staff} ->
        conn
        |> put_flash(
          :info,
          "Cambios guardados para #{staff.email}. Sus sesiones abiertas se han cerrado."
        )
        |> redirect(to: ~p"/backoffice/team")

      error ->
        failure(conn, error)
    end
  end

  def reset_access(conn, %{"id" => id}) do
    case Team.reset_access(conn.assigns.current_staff, id) do
      {:ok, result} -> invitation(conn, result)
      error -> failure(conn, error)
    end
  end

  def activity(conn, params) do
    params = Map.take(params, ~w(group person offset))

    case Casework.activity(conn.assigns.current_staff, params) do
      {:ok, data} ->
        render(
          conn,
          :activity,
          Map.merge(data, %{params: params, offset: Casework.offset(params)})
        )

      _ ->
        forbidden(conn)
    end
  end

  defp listing(conn, params, error) do
    offset = Casework.offset(params)
    actor = conn.assigns.current_staff

    with {:ok, staff} <- Team.list(actor, offset),
         {:ok, signals} <- Team.signals(actor, Enum.map(staff, & &1.id)) do
      render(conn, :team, staff: staff, signals: signals, error: error, offset: offset)
    else
      _ -> forbidden(conn)
    end
  end

  defp invitation(conn, %{staff: staff, code: code}),
    do: render(conn, :invitation_created, invited_staff: staff, code: code)

  defp forbidden(conn) do
    conn
    |> put_status(:forbidden)
    |> render(:error,
      title: "Solo para superusuarios",
      message:
        "La gestión del equipo y el registro de actividad están reservados al superusuario. Si necesitas un cambio de permisos, pídeselo."
    )
  end

  defp failure(conn, {:error, :forbidden}), do: forbidden(conn)

  defp failure(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> render(:error,
      title: "No encontramos esa cuenta",
      message: "Puede que la referencia esté mal copiada. Vuelve al equipo y elige a la persona."
    )
  end

  defp failure(conn, {:error, :last_superadmin}),
    do:
      conn
      |> put_status(:conflict)
      |> listing(
        %{},
        "Debe quedar al menos un superusuario activo. Activa antes a otra persona como superusuario."
      )

  defp failure(conn, _),
    do:
      conn
      |> put_status(:unprocessable_entity)
      |> listing(%{}, "Comprueba el correo y el rol. No se permiten correos duplicados.")
end
