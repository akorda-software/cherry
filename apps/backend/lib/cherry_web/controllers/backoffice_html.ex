defmodule CherryWeb.BackofficeHTML do
  use CherryWeb, :html
  embed_templates("backoffice_html/*")

  attr(:staff, :any, default: nil)
  attr(:title, :string, required: true)
  slot(:inner_block, required: true)

  def shell(assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{@title} · Cherry</title>
        <link rel="stylesheet" href={~p"/assets/backoffice.css"} />
      </head>
      <body>
        <a class="skip" href="#content">Saltar al contenido</a>
        <header class="masthead">
          <a href={~p"/backoffice"} class="brand">Cherry <span>Atención y seguridad</span></a>
          <nav :if={@staff} aria-label="Áreas del backoffice">
            <a href={~p"/backoffice"}>Expedientes</a>
            <a :if={@staff.role == "superadmin"} href={~p"/backoffice/team"}>Equipo y permisos</a>
          </nav>
          <.form :if={@staff} for={%{}} action={~p"/backoffice/logout"}>
            <span>{@staff.email} · {label(@staff.role)}</span>
            <button class="secondary" type="submit">Cerrar sesión</button>
          </.form>
        </header>
        <main id="content">{render_slot(@inner_block)}</main>
        <footer>
          Acceso restringido. Consulta solo los datos necesarios para atender cada caso.
        </footer>
      </body>
    </html>
    """
  end

  def label(value) do
    Map.get(
      %{
        "report" => "Reporte",
        "complaint" => "Reclamación",
        "privacy" => "Privacidad",
        "appeal" => "Recurso",
        "measure" => "Medida vigente · ficha mínima",
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
        "case_reopened" => "Nueva revisión abierta",
        "case_resolved" => "Resolución",
        "appeal_created" => "Recurso recibido",
        "measure_preserved" => "Medida trasladada a ficha mínima",
        "measure_review_preserved" => "Revisión trasladada a ficha mínima"
      },
      value,
      value || "—"
    )
  end
end
