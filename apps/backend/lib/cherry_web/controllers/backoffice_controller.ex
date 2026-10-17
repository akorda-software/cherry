defmodule CherryWeb.BackofficeController do
  use CherryWeb, :controller
  alias Cherry.Backoffice.Access
  alias Cherry.Casework
  alias CherryWeb.Plugs.BackofficeSession
  plug(:put_layout, false)
  plug(:put_root_layout, false)

  plug(
    :require_staff
    when action not in [:login, :create_session, :invitation, :accept_invitation]
  )

  defp require_staff(conn, opts), do: BackofficeSession.require_staff(conn, opts)

  def login(conn, _), do: render(conn, :login, error: nil)

  def create_session(conn, params) do
    result =
      if params["method"] == "password",
        do: Access.password_login(params["email"], params["password"], conn.remote_ip),
        else: Access.exchange(params["code"])

    case result do
      {:ok, %{token: token}} ->
        conn |> BackofficeSession.sign_in(token) |> redirect(to: "/backoffice")

      _ ->
        conn
        |> put_status(:unauthorized)
        |> render(:login,
          error:
            "Código inválido o credenciales incorrectas. Si has repetido varios intentos, espera quince minutos."
        )
    end
  end

  def invitation(conn, _), do: render(conn, :invitation, error: nil)

  def accept_invitation(conn, params) do
    case Access.accept_invitation(params["code"], params["password"]) do
      {:ok, %{token: token}} ->
        conn |> BackofficeSession.sign_in(token) |> redirect(to: "/backoffice")

      _ ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:invitation,
          error:
            "Comprueba el código y utiliza una contraseña de al menos 16 caracteres (máximo 256 bytes). El código caduca en 24 horas y solo sirve una vez."
        )
    end
  end

  def delete_session(conn, _),
    do: conn |> BackofficeSession.sign_out() |> redirect(to: "/backoffice/login")

  def index(conn, params) do
    case Casework.queue(conn.assigns.current_staff, params) do
      {:ok, cases} ->
        render(conn, :index, cases: cases, params: params, offset: Casework.offset(params))

      error ->
        failure(conn, error)
    end
  end

  def show(conn, %{"id" => id}) do
    case Casework.view(conn.assigns.current_staff, id) do
      {:ok, data} ->
        render(
          conn,
          :show,
          Map.merge(data, %{error: nil, outcomes: Casework.outcomes(data.case), form_values: %{}})
        )

      error ->
        failure(conn, error)
    end
  end

  def claim(conn, %{"id" => id}) do
    case Casework.claim(conn.assigns.current_staff, id) do
      {:ok, _} -> redirect(conn, to: ~p"/backoffice/cases/#{id}")
      error -> failure(conn, error)
    end
  end

  def resolve(conn, %{"id" => id} = params) do
    case Casework.resolve(conn.assigns.current_staff, id, params) do
      {:ok, record} ->
        if record.outcome == "suspend" do
          CherryWeb.Endpoint.broadcast("user_socket:#{record.subject_user_id}", "disconnect", %{})
        end

        redirect(conn, to: ~p"/backoffice/cases/#{id}")

      {:error, %Ecto.Changeset{}} ->
        invalid_resolution(conn, id, params)

      error ->
        failure(conn, error)
    end
  end

  defp invalid_resolution(conn, id, params) do
    values =
      Map.new(["outcome", "response", "reporter_response"], fn key ->
        value = params[key]
        {key, if(is_binary(value), do: String.slice(value, 0, 4000), else: "")}
      end)

    case Casework.view(conn.assigns.current_staff, id) do
      {:ok, data} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(
          :show,
          Map.merge(data, %{
            error:
              "Selecciona una decisión y escribe los motivos (entre 20 y 4.000 caracteres por respuesta).",
            outcomes: Casework.outcomes(data.case),
            form_values: values
          })
        )

      error ->
        failure(conn, error)
    end
  end

  def reassign(conn, %{"id" => id}) do
    case Casework.reassign(conn.assigns.current_staff, id) do
      {:ok, _} -> redirect(conn, to: ~p"/backoffice/cases/#{id}")
      error -> failure(conn, error)
    end
  end

  defp failure(conn, {:error, :not_found}),
    do: conn |> put_status(:not_found) |> text("Expediente no encontrado.")

  defp failure(conn, {:error, :forbidden}),
    do: conn |> put_status(:forbidden) |> text("No tienes permiso para esta operación.")

  defp failure(conn, {:error, :independent_reviewer_required}),
    do:
      conn
      |> put_status(:conflict)
      |> text(
        "El recurso debe revisarlo otra persona distinta de quien tomó la decisión original."
      )

  defp failure(conn, _),
    do:
      conn
      |> put_status(:conflict)
      |> text(
        "El expediente ha cambiado o requiere asignación previa. Recarga antes de continuar."
      )
end
