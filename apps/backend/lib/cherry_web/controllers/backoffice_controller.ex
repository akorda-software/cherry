defmodule CherryWeb.BackofficeController do
  use CherryWeb, :controller
  alias Cherry.Backoffice.Access
  alias Cherry.Casework
  alias CherryWeb.BackofficeModels
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

  def dashboard(conn, _) do
    case Casework.overview(conn.assigns.current_staff) do
      {:ok, overview} -> render(conn, :dashboard, overview: overview)
      error -> failure(conn, error)
    end
  end

  def index(conn, params) do
    staff = conn.assigns.current_staff
    params = Map.take(params, ~w(status kind owner category q offset))
    search = Casework.search_term(params["q"])

    case search do
      # A full reference opens the case directly, whatever its state.
      {:id, id} ->
        redirect(conn, to: ~p"/backoffice/cases/#{id}")

      _ ->
        query = if search, do: Map.put(params, "status", "all"), else: params

        with {:ok, cases} <- Casework.queue(staff, query),
             {:ok, counts} <- Casework.queue_counts(staff, params) do
          names =
            Casework.staff_names(
              Enum.flat_map(cases, &[&1.assigned_staff_id, &1.decided_by_staff_id])
            )

          render(conn, :index,
            cases: cases,
            counts: counts,
            params: params,
            search: search,
            names: names,
            offset: Casework.offset(params)
          )
        else
          error -> failure(conn, error)
        end
    end
  end

  def show(conn, %{"id" => id} = params) do
    staff = conn.assigns.current_staff

    case Casework.view(staff, id) do
      {:ok, data} ->
        render(
          conn,
          :show,
          case_assigns(data, %{form_values: model(data, params["modelo"], staff)})
        )

      error ->
        failure(conn, error)
    end
  end

  # Starting from a model replaces the draft: offered only to the assignee.
  defp model(%{case: record, appeal_by: appeal_by}, outcome, staff) do
    if record.status == "open" and record.assigned_staff_id == staff.id and
         outcome in Casework.outcomes(record),
       do: BackofficeModels.draft(record.kind, outcome, appeal_by),
       else: %{}
  end

  defp case_assigns(data, overrides) do
    data
    |> Map.merge(%{
      error: nil,
      note_error: nil,
      note_draft: nil,
      outcomes: Casework.outcomes(data.case),
      form_values: %{}
    })
    |> Map.merge(overrides)
  end

  def claim(conn, %{"id" => id}) do
    case Casework.claim(conn.assigns.current_staff, id) do
      {:ok, _} -> done(conn, id, "Expediente asignado a ti. Ya puedes decidir.")
      error -> failure(conn, error, id)
    end
  end

  def claim_next(conn, _) do
    case Casework.claim_next(conn.assigns.current_staff) do
      {:ok, record} ->
        done(conn, record.id, "Te has asignado el siguiente expediente de la cola.")

      {:error, :empty} ->
        conn
        |> put_flash(:info, "No quedan expedientes sin asignar en tus áreas.")
        |> redirect(to: ~p"/backoffice")

      error ->
        failure(conn, error)
    end
  end

  def reassign(conn, %{"id" => id}) do
    case Casework.reassign(conn.assigns.current_staff, id) do
      {:ok, _} -> done(conn, id, "Ahora el expediente es tuyo.")
      error -> failure(conn, error, id)
    end
  end

  def assign(conn, %{"id" => id} = params) do
    case Casework.assign(conn.assigns.current_staff, id, params["staff_id"]) do
      {:ok, record} ->
        email = Casework.staff_names([record.assigned_staff_id])[record.assigned_staff_id]
        done(conn, id, "Expediente asignado a #{email}.")

      error ->
        failure(conn, error, id)
    end
  end

  def release(conn, %{"id" => id}) do
    case Casework.release(conn.assigns.current_staff, id) do
      {:ok, _} -> done(conn, id, "Expediente liberado: vuelve a la cola sin responsable.")
      error -> failure(conn, error, id)
    end
  end

  def add_note(conn, %{"id" => id} = params) do
    case Casework.add_note(conn.assigns.current_staff, id, params["note"]) do
      {:ok, _} ->
        conn
        |> put_flash(:info, "Nota guardada. Solo la ve el equipo.")
        |> redirect(to: ~p"/backoffice/cases/#{id}" <> "#notas")

      {:error, %Ecto.Changeset{}} ->
        draft = if is_binary(params["note"]), do: String.slice(params["note"], 0, 2000), else: ""

        rerender(conn, id, %{
          note_error: "Escribe una nota de entre 3 y 2.000 caracteres.",
          note_draft: draft
        })

      error ->
        failure(conn, error, id)
    end
  end

  def resolve(conn, %{"id" => id} = params) do
    if params["outcome"] == "suspend" and params["confirm_suspend"] != "true" do
      invalid_resolution(
        conn,
        id,
        params,
        "Para suspender la cuenta, marca la casilla que confirma que los hechos comprobados lo justifican."
      )
    else
      case Casework.resolve(conn.assigns.current_staff, id, params) do
        {:ok, record} ->
          if record.outcome == "suspend" do
            CherryWeb.Endpoint.broadcast(
              "user_socket:#{record.subject_user_id}",
              "disconnect",
              %{}
            )
          end

          done(conn, id, "Decisión guardada. Los avisos ya están en el buzón de la app.")

        {:error, %Ecto.Changeset{} = changeset} ->
          invalid_resolution(conn, id, params, resolution_error(changeset))

        error ->
          failure(conn, error, id)
      end
    end
  end

  defp resolution_error(changeset) do
    if Enum.any?(changeset.errors, fn {_, {message, _}} -> message == "contains template gaps" end),
       do:
         "Sustituye los huecos entre corchetes del modelo, como [HECHOS COMPROBADOS], por el texto real antes de guardar.",
       else:
         "Selecciona una decisión y escribe los motivos (entre 20 y 4.000 caracteres por respuesta)."
  end

  defp invalid_resolution(conn, id, params, message) do
    values =
      Map.new(["outcome", "response", "reporter_response"], fn key ->
        value = params[key]
        {key, if(is_binary(value), do: String.slice(value, 0, 4000), else: "")}
      end)

    rerender(conn, id, %{error: message, form_values: values})
  end

  defp rerender(conn, id, overrides) do
    case Casework.view(conn.assigns.current_staff, id) do
      {:ok, data} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render(:show, case_assigns(data, overrides))

      error ->
        failure(conn, error)
    end
  end

  def measures(conn, params) do
    case Casework.measures(conn.assigns.current_staff, params) do
      {:ok, data} -> render(conn, :measures, Map.put(data, :offset, Casework.offset(params)))
      error -> failure(conn, error)
    end
  end

  defp done(conn, id, message),
    do: conn |> put_flash(:info, message) |> redirect(to: ~p"/backoffice/cases/#{id}")

  @conflicts %{
    assigned_elsewhere: "Otra persona se ha asignado este expediente antes que tú.",
    already_resolved: "Este expediente ya está resuelto.",
    claim_required: "Asígnate el expediente antes de decidir.",
    independent_reviewer_required:
      "Tomaste la decisión original, así que este expediente debe resolverlo otra persona.",
    invalid_assignee:
      "No se puede asignar a esa persona: necesita un acceso activo, permisos para este tipo de expediente y no haber decidido el original.",
    already_suspended:
      "La cuenta ya está suspendida por otra decisión. Revisa la medida vigente antes de decidir.",
    subject_unavailable: "La cuenta afectada ya no existe.",
    measure_changed: "La medida original ha cambiado. Revisa el expediente antes de decidir.",
    parent_unavailable: "La decisión original ya no está disponible."
  }

  # State conflicts go back to the case with an explanation; the rest are pages.
  defp failure(conn, error, id \\ nil)

  defp failure(conn, {:error, reason}, id)
       when is_binary(id) and is_map_key(@conflicts, reason) do
    conn
    |> put_flash(:error, Map.fetch!(@conflicts, reason))
    |> redirect(to: ~p"/backoffice/cases/#{id}")
  end

  defp failure(conn, {:error, :not_found}, _),
    do:
      error_page(
        conn,
        :not_found,
        "No encontramos ese expediente",
        "Comprueba la referencia. Un expediente desaparece si se borra la cuenta de quien lo presentó o de la persona afectada."
      )

  defp failure(conn, {:error, :forbidden}, _),
    do:
      error_page(
        conn,
        :forbidden,
        "Esto no es de tu área",
        "Tu rol no permite consultarlo ni hacer esta operación. Si lo necesitas, pide a un superusuario que revise tus permisos."
      )

  defp failure(conn, _, _),
    do:
      error_page(
        conn,
        :conflict,
        "El expediente ha cambiado",
        "Otra persona lo ha modificado a la vez o necesita asignación previa. Vuelve a abrirlo antes de continuar."
      )

  defp error_page(conn, status, title, message) do
    conn
    |> put_status(status)
    |> put_view(html: CherryWeb.BackofficeHTML)
    |> render(:error, title: title, message: message)
  end
end
