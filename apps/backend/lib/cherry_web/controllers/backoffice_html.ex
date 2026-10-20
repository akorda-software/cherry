defmodule CherryWeb.BackofficeHTML do
  use CherryWeb, :html
  alias Cherry.Backoffice.Access
  embed_templates("backoffice_html/*")

  attr(:staff, :any, default: nil)
  attr(:title, :string, required: true)
  attr(:section, :string, default: nil)
  attr(:flash, :map, default: %{})
  slot(:inner_block, required: true)

  def shell(assigns) do
    assigns =
      assign(assigns,
        info: Phoenix.Flash.get(assigns.flash, :info),
        alert: Phoenix.Flash.get(assigns.flash, :error)
      )

    ~H"""
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{@title} · Cherry</title>
        <link rel="icon" href={~p"/images/mochi.svg"} type="image/svg+xml" />
        <link rel="stylesheet" href={~p"/assets/backoffice.css"} />
      </head>
      <body class={if @staff, do: "signed-in", else: "signed-out"}>
        <a class="skip" href="#content">Saltar al contenido</a>
        <header class="topbar">
          <a href={~p"/backoffice"} class="brand">
            <CherryWeb.Brand.mochi size={40} />
            <span class="brand-text">
              <strong>Cherry</strong>
              <span>Atención y seguridad</span>
            </span>
          </a>
          <nav :if={@staff} class="tabs" aria-label="Áreas del backoffice">
            <a
              href={~p"/backoffice"}
              class="tab tab-home"
              aria-current={if @section == "home", do: "page"}
            >
              <CherryWeb.Brand.icon name="home" /> Inicio
            </a>
            <a
              href={~p"/backoffice/cases"}
              class="tab tab-cases"
              aria-current={if @section == "cases", do: "page"}
            >
              <CherryWeb.Brand.icon name="inbox" /> Expedientes
            </a>
            <a
              :if={moderation?(@staff)}
              href={~p"/backoffice/measures"}
              class="tab tab-measures"
              aria-current={if @section == "measures", do: "page"}
            >
              <CherryWeb.Brand.icon name="pause" /> Medidas
            </a>
            <a
              :if={superadmin?(@staff)}
              href={~p"/backoffice/team"}
              class="tab tab-team"
              aria-current={if @section == "team", do: "page"}
            >
              <CherryWeb.Brand.icon name="team" /> Equipo
            </a>
            <a
              :if={superadmin?(@staff)}
              href={~p"/backoffice/activity"}
              class="tab tab-activity"
              aria-current={if @section == "activity", do: "page"}
            >
              <CherryWeb.Brand.icon name="clock" /> Actividad
            </a>
          </nav>
          <div :if={@staff} class="session">
            <a
              href={~p"/backoffice/account"}
              class="who"
              aria-current={if @section == "account", do: "page"}
            >
              <span class="who-avatar" aria-hidden="true">{initial(@staff.email)}</span>
              <span class="who-text">
                <span class="sr-only">Mi acceso:</span>
                <span class="who-email">{@staff.email}</span>
                <span class="who-role">{label(@staff.role)}</span>
              </span>
              <CherryWeb.Brand.icon name="key" />
            </a>
            <.form for={%{}} action={~p"/backoffice/logout"}>
              <button class="btn btn-sm" type="submit">
                <CherryWeb.Brand.icon name="logout" /> Salir
              </button>
            </.form>
          </div>
        </header>
        <main id="content">
          <p :if={@info} class="flash flash-info" role="status">
            <CherryWeb.Brand.icon name="check" />
            <span>{@info}</span>
          </p>
          <p :if={@alert} class="flash flash-error" role="alert">
            <CherryWeb.Brand.icon name="flag" />
            <span>{@alert}</span>
          </p>
          {render_slot(@inner_block)}
        </main>
        <footer class="footnote">
          <CherryWeb.Brand.icon name="lock" />
          Acceso restringido. Consulta solo los datos necesarios para atender cada caso.
        </footer>
      </body>
    </html>
    """
  end

  attr(:record, :map, required: true)
  attr(:class, :string, default: nil)

  @doc "Kind chip of a case."
  def kind_chip(assigns) do
    ~H"""
    <span class={["kind", "kind-" <> @record.kind, @class]}>{label(@record.kind)}</span>
    """
  end

  attr(:record, :map, required: true)
  attr(:meta, :string, default: nil)

  @doc "Compact case line for the dashboard, account history and linked cases."
  def case_line(assigns) do
    ~H"""
    <li class={[
      "case-line",
      @record.category == "underage" && @record.status == "open" && "is-priority"
    ]}>
      <.kind_chip record={@record} />
      <a class="case-line-link" href={~p"/backoffice/cases/#{@record.id}"}>
        {label(@record.category)}
      </a>
      <span class="case-line-ref">{short_id(@record.id)}</span>
      <span class="case-line-meta">{@meta || ago(@record.inserted_at)}</span>
    </li>
    """
  end

  @doc "Where a case stands, in a few words."
  def case_status(%{status: "resolved", outcome: outcome}) when is_binary(outcome),
    do: label(outcome)

  def case_status(%{status: status}), do: label(status)

  def kind_plural("report"), do: "Reportes"
  def kind_plural("appeal"), do: "Recursos"
  def kind_plural("complaint"), do: "Reclamaciones"
  def kind_plural("privacy"), do: "Privacidad"
  def kind_plural("measure"), do: "Fichas mínimas"

  def role_text("superadmin"), do: "Gestiona el equipo, sus permisos y todos los expedientes."

  def role_text("admin"),
    do: "Atiende todas las áreas y puede reasignar expedientes. No concede permisos."

  def role_text("moderator"),
    do: "Reportes, reclamaciones, recursos y medidas. Sin solicitudes de privacidad."

  def role_text("privacy"), do: "Solicitudes de derechos de privacidad. Sin moderación."

  @weekdays ~w(lunes martes miércoles jueves viernes sábado domingo)
  @month_names ~w(enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre)

  @doc "«martes, 20 de octubre»"
  def long_date(%Date{} = day),
    do:
      "#{Enum.at(@weekdays, Date.day_of_week(day) - 1)}, #{day.day} de #{Enum.at(@month_names, day.month - 1)}"

  def request_title("report"), do: "Reporte recibido"
  def request_title("appeal"), do: "Recurso recibido"
  def request_title("measure"), do: "Ficha de la medida"
  def request_title(_), do: "Solicitud recibida"

  def moderation?(staff), do: Access.allowed?(staff, "report")
  def privacy?(staff), do: Access.allowed?(staff, "privacy")
  def superadmin?(staff), do: Access.allowed?(staff, :manage_team)
  def reassign?(staff), do: Access.allowed?(staff, :reassign)

  @doc "Kinds of case the member can see, in queue order."
  def kinds_for(staff),
    do: Enum.filter(~w(report appeal complaint privacy measure), &Access.allowed?(staff, &1))

  def initial(email), do: email |> String.first() |> String.upcase()

  @doc "Who: «Tú», the colleague's email or a neutral placeholder."
  def person(_names, nil, _me), do: "Nadie"
  def person(_names, id, %{id: id}), do: "Tú"
  def person(names, id, _me), do: Map.get(names, id, "Una cuenta del equipo")

  @doc "Queue link that keeps the active filters and drops empty ones."
  def queue_path(params, changes) do
    query =
      params
      |> Map.delete("offset")
      |> Map.merge(changes)
      |> Enum.reject(fn {_, value} -> value in [nil, ""] end)
      |> Map.new()

    if query == %{}, do: ~p"/backoffice/cases", else: ~p"/backoffice/cases?#{query}"
  end

  @months ~w(ene feb mar abr may jun jul ago sep oct nov dic)

  @doc "Fecha corta en español («19 oct 2026»); con hora para marcas de tiempo."
  def date(nil), do: "—"

  def date(%DateTime{} = at),
    do: "#{date(DateTime.to_date(at))}, #{Calendar.strftime(at, "%H:%M")} UTC"

  def date(%NaiveDateTime{} = at), do: at |> DateTime.from_naive!("Etc/UTC") |> date()

  def date(%Date{} = day), do: "#{day.day} #{Enum.at(@months, day.month - 1)} #{day.year}"

  def time(%DateTime{} = at), do: Calendar.strftime(at, "%H:%M")

  def iso(%Date{} = day), do: Date.to_iso8601(day)
  def iso(%DateTime{} = at), do: DateTime.to_iso8601(at)
  def iso(%NaiveDateTime{} = at), do: NaiveDateTime.to_iso8601(at)
  def iso(_), do: nil

  @doc "«hace 5 min», «hace 3 h», «ayer», «hace 4 días»…"
  def ago(nil), do: "—"
  def ago(%NaiveDateTime{} = at), do: at |> DateTime.from_naive!("Etc/UTC") |> ago()

  def ago(%DateTime{} = at) do
    seconds = DateTime.diff(DateTime.utc_now(), at)
    days = Date.diff(Date.utc_today(), DateTime.to_date(at))

    cond do
      seconds < 60 -> "hace un momento"
      seconds < 3600 -> "hace #{div(seconds, 60)} min"
      days == 0 -> "hace #{div(seconds, 3600)} h"
      days == 1 -> "ayer"
      days < 31 -> "hace #{days} días"
      days < 365 -> plural(div(days, 30), "hace 1 mes", "hace %d meses")
      true -> plural(div(days, 365), "hace 1 año", "hace %d años")
    end
  end

  @doc "Days left until a reminder date: «vence hoy», «vence en 3 días», «venció hace 2 días»."
  def due(%Date{} = date) do
    case Date.diff(date, Date.utc_today()) do
      0 -> "vence hoy"
      1 -> "vence mañana"
      n when n > 1 -> "vence en #{n} días"
      -1 -> "venció ayer"
      n -> "venció hace #{-n} días"
    end
  end

  def due_soon?(%Date{} = date), do: Date.diff(date, Date.utc_today()) in 0..7

  def plural(1, one, _many), do: one
  def plural(n, _one, many), do: String.replace(many, "%d", Integer.to_string(n))

  def short_id(id), do: String.slice(id || "", 0, 8)

  @doc "What each decision does, shown next to the option."
  def outcome_hint("report", "dismissed", _),
    do: "Se avisa a quien reportó. La persona reportada no recibe nada."

  def outcome_hint("report", "warning", _),
    do: "Se avisa a las dos partes. La cuenta sigue activa."

  def outcome_hint("report", "suspend", _),
    do:
      "Oculta el perfil y bloquea likes, matches y mensajes. Conserva buzón, privacidad y baja. Solo la revoca un recurso estimado."

  def outcome_hint("appeal", "upheld", _),
    do: "Se mantiene la decisión original y se avisa a quien recurrió."

  def outcome_hint("appeal", "overturned", :affected),
    do: "Revoca la decisión. Si la cuenta sigue suspendida por ella, vuelve a estar activa."

  def outcome_hint("appeal", "overturned", _),
    do: "Abre una revisión nueva del caso original, sin sanción automática."

  def outcome_hint("privacy", "answered", _),
    do: "Envía tu respuesta a su buzón. Responder no exporta ni borra datos por sí solo."

  def outcome_hint(_, "answered", _), do: "Envía tu respuesta a su buzón."
  def outcome_hint(_, "refused", _), do: "Explica por qué no se atiende y qué vías le quedan."
  def outcome_hint(_, _, _), do: nil

  def appeal_by_text(:affected), do: "Recurre la persona afectada por la decisión."
  def appeal_by_text(:reporter), do: "Recurre quien presentó el reporte."
  def appeal_by_text(:claimant), do: "Recurre quien presentó la reclamación."
  def appeal_by_text(_), do: nil

  def verification_text(nil), do: "Edad sin verificar"

  def verification_text(%{status: "verified", method: method, verified_at: at}),
    do: "Edad verificada con #{method_label(method)}, #{date(DateTime.to_date(at))}"

  def verification_text(%{status: "revoked"}), do: "Verificación de edad revocada"
  def verification_text(_), do: "Edad sin verificar"

  defp method_label("nfc_dni"), do: "DNI o NIE por NFC"
  defp method_label("nfc_passport"), do: "pasaporte por NFC"
  defp method_label("provider"), do: "un proveedor externo"
  defp method_label("eu_wallet"), do: "la cartera europea"
  defp method_label(_), do: "un método no indicado"

  @doc "Folds runs of views by the same person into one timeline entry with a count."
  def fold_views(events) do
    events
    |> Enum.chunk_by(fn event ->
      if event.action == "case_viewed", do: {:viewed, event.staff_id}, else: {:event, event.id}
    end)
    |> Enum.map(fn [latest | _] = run -> {latest, length(run)} end)
  end

  @doc "Extra detail of an audit event: whom it concerned or what was decided."
  def event_detail(%{action: action, metadata: metadata}, names, me) do
    metadata = metadata || %{}
    target = metadata["target_staff_id"]
    previous = metadata["previous_staff_id"]

    case action do
      "case_resolved" ->
        label(metadata["outcome"])

      "case_reassigned" when is_binary(target) ->
        "Para #{person(names, target, me)}" <>
          if(previous, do: ", antes #{person(names, previous, me)}", else: "")

      "case_reassigned" when is_binary(previous) ->
        "Antes #{person(names, previous, me)}"

      "case_released" when is_binary(previous) ->
        "Estaba asignado a #{person(names, previous, me)}"

      "staff_invited" ->
        "#{person(names, target, me)}, como #{String.downcase(label(metadata["role"]))}"

      "staff_access_changed" ->
        state = if metadata["disabled"], do: "desactivada", else: "activa"
        "#{person(names, target, me)}: #{String.downcase(label(metadata["role"]))}, #{state}"

      "staff_access_reset" ->
        person(names, target, me)

      "staff_sessions_revoked" ->
        plural(metadata["count"] || 0, "1 sesión", "%d sesiones")

      _ ->
        nil
    end
  end

  @system_actions ~w(measure_preserved measure_review_preserved case_reopened)

  @doc "Who did it, for the timeline and the activity log."
  def actor(%{action: action}, _names, _me) when action in @system_actions,
    do: "Automático"

  def actor(%{staff_id: nil, user_id: user_id}, _names, _me) when not is_nil(user_id),
    do: "Persona usuaria"

  def actor(%{staff_id: nil}, _names, _me), do: "Sistema"
  def actor(%{staff_id: id}, names, me), do: person(names, id, me)

  def label(value) do
    Map.get(
      %{
        "report" => "Reporte",
        "complaint" => "Reclamación",
        "privacy" => "Privacidad",
        "appeal" => "Recurso",
        "measure" => "Ficha mínima",
        "open" => "Pendiente",
        "resolved" => "Resuelto",
        "admin" => "Administración",
        "superadmin" => "Superusuario",
        "moderator" => "Moderación",
        "underage" => "Posible menor",
        "fake_profile" => "Perfil falso",
        "harassment" => "Acoso",
        "spam" => "Spam",
        "inappropriate_photos" => "Fotos inapropiadas",
        "offensive_bio" => "Biografía ofensiva",
        "other" => "Otro",
        "access" => "Acceso a datos",
        "rectification" => "Rectificación",
        "erasure" => "Supresión",
        "restriction" => "Limitación",
        "portability" => "Portabilidad",
        "objection" => "Oposición",
        "service" => "Servicio",
        "safety" => "Seguridad",
        "dismissed" => "Sin infracción acreditada",
        "warning" => "Advertencia",
        "suspend" => "Suspender cuenta",
        "answered" => "Responder solicitud",
        "refused" => "Denegar con motivos",
        "upheld" => "Confirmar decisión",
        "overturned" => "Revocar decisión",
        "case_created" => "Expediente recibido",
        "case_viewed" => "Consulta del expediente",
        "case_assigned" => "Asignación",
        "case_reassigned" => "Reasignación",
        "case_released" => "Liberado",
        "case_note_added" => "Nota interna",
        "case_reopened" => "Nueva revisión abierta",
        "case_resolved" => "Resolución",
        "appeal_created" => "Recurso recibido",
        "measure_preserved" => "Medida trasladada a ficha mínima",
        "measure_review_preserved" => "Revisión trasladada a ficha mínima",
        "staff_login" => "Inicio de sesión",
        "staff_logout" => "Cierre de sesión",
        "login_issued" => "Código de acceso emitido",
        "staff_invited" => "Invitación creada",
        "staff_invitation_accepted" => "Invitación aceptada",
        "staff_access_changed" => "Permisos cambiados",
        "staff_access_reset" => "Acceso restablecido",
        "staff_password_changed" => "Contraseña cambiada",
        "staff_provisioned" => "Alta por consola",
        "staff_disabled" => "Baja por consola",
        "staff_bootstrapped" => "Alta inicial",
        "staff_sessions_revoked" => "Otras sesiones cerradas"
      },
      value,
      value || "—"
    )
  end

  @doc "Labels of the activity log filters."
  def activity_group_label("decisions"), do: "Decisiones"
  def activity_group_label("assignments"), do: "Asignaciones"
  def activity_group_label("notes"), do: "Notas"
  def activity_group_label("views"), do: "Consultas"
  def activity_group_label("intake"), do: "Entradas"
  def activity_group_label("team"), do: "Equipo"
  def activity_group_label("access"), do: "Accesos"
end
