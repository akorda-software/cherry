defmodule CherryWeb.BackofficeModels do
  @moduledoc """
  Starting texts for each decision, adapted from `docs/compliance/16`. What
  staff must fill in goes in «[MAYÚSCULAS]»: `Cherry.Casework.Case` rejects a
  reply that still contains one. Never sent as they are.
  """

  @doc "Model for `field` (`response` or `reporter_response`), or nil."
  def text(kind, outcome, field, appeal_by \\ nil)

  def text("report", "dismissed", "response", _),
    do:
      "Revisado el reporte por [MOTIVO DEL REPORTE]. Con la información disponible no se acredita una infracción de las normas: [QUÉ SE HA COMPROBADO Y POR QUÉ NO BASTA]."

  def text("report", "dismissed", "reporter_response", _),
    do:
      "Gracias por avisarnos. Hemos revisado tu reporte y, con la información disponible, no hemos podido comprobar que incumpla las normas de Cherry: [MOTIVO BREVE, SIN DATOS DE LA OTRA PERSONA]. Si vuelve a pasar o tienes más información, puedes enviar otro reporte. Si no estás de acuerdo, puedes pedir aquí que otra persona del equipo lo revise."

  def text("report", "warning", "response", _),
    do:
      "Hemos revisado un reporte sobre tu cuenta. [HECHOS COMPROBADOS, SIN DATOS DE QUIEN REPORTÓ]. Esto va contra las normas de Cherry: [NORMA QUE SE APLICA]. De momento es una advertencia y tu cuenta sigue activa con normalidad; si se repite, podemos suspenderla. Esta decisión la ha tomado una persona del equipo, sin automatismos. Si no estás de acuerdo, puedes pedir aquí que otra persona la revise."

  def text("report", "suspend", "response", _),
    do:
      "Hemos revisado un reporte sobre tu cuenta. [HECHOS COMPROBADOS, SIN DATOS DE QUIEN REPORTÓ]. Esto incumple las normas de Cherry: [NORMA QUE SE APLICA]. Por eso hemos suspendido tu cuenta: tu perfil deja de mostrarse y no puedes dar likes, hacer match ni enviar mensajes. Puedes seguir usando este buzón, ejercer tus derechos de privacidad y borrar tu cuenta. Esta decisión la ha tomado una persona del equipo, sin automatismos. Si no estás de acuerdo, puedes pedir aquí que otra persona la revise."

  def text("report", outcome, "reporter_response", _) when outcome in ~w(warning suspend),
    do:
      "Gracias por avisarnos. Hemos revisado tu reporte y hemos tomado medidas sobre esa cuenta. Por privacidad no podemos darte más detalles. Si vuelve a pasar, repórtalo de nuevo. Si no estás de acuerdo con el resultado, puedes pedir aquí que otra persona del equipo lo revise."

  def text("appeal", "upheld", "response", _),
    do:
      "Otra persona del equipo, distinta de quien decidió, ha revisado de nuevo el caso y mantiene la decisión: [MOTIVOS DE LA REVISIÓN]."

  def text("appeal", "overturned", "response", :affected),
    do:
      "Otra persona del equipo, distinta de quien decidió, ha revisado de nuevo el caso y revoca la decisión: [MOTIVOS DE LA REVISIÓN]. Si tu cuenta estaba suspendida por esa decisión, vuelve a estar activa."

  def text("appeal", "overturned", "response", _),
    do:
      "Otra persona del equipo, distinta de quien decidió, ha revisado de nuevo el caso y te da la razón: [MOTIVOS DE LA REVISIÓN]. Hemos abierto una revisión nueva, que puedes seguir en este buzón."

  def text("privacy", "answered", "response", _),
    do:
      "Hemos atendido tu solicitud de [DERECHO QUE EJERCES], recibida el [FECHA DE RECEPCIÓN]. Hemos hecho lo siguiente: [ACTUACIONES COMPROBADAS Y FECHA]. [CÓMO TE LLEGA O QUÉ EFECTOS TIENE]. [DATOS QUE NO SE INCLUYEN Y POR QUÉ, SI LOS HAY]. Si tienes dudas, escríbenos a #{contact()}. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es)."

  def text("privacy", "refused", "response", _),
    do:
      "No podemos atender [PARTE DE LA SOLICITUD] porque [MOTIVO Y FUNDAMENTO CONCRETOS], tras valorar [HECHOS VALORADOS]. [LO QUE SÍ HEMOS HECHO, SI PROCEDE]. Puedes pedir que lo revisemos escribiendo a #{contact()}, reclamar ante la Agencia Española de Protección de Datos (aepd.es) y ejercer las acciones legales que correspondan."

  def text("complaint", "answered", "response", _),
    do:
      "Hemos revisado tu reclamación sobre [ASUNTO DE LA RECLAMACIÓN]. [QUÉ HEMOS COMPROBADO]. [QUÉ HEMOS HECHO O VAMOS A HACER, CON FECHAS SI LAS HAY]. Si no estás de acuerdo, puedes pedir aquí que otra persona del equipo lo revise."

  def text("complaint", "refused", "response", _),
    do:
      "Hemos revisado tu reclamación sobre [ASUNTO DE LA RECLAMACIÓN] y no podemos atenderla porque [MOTIVO CONCRETO]. Si no estás de acuerdo, puedes pedir aquí que otra persona del equipo lo revise."

  def text(_, _, _, _), do: nil

  @doc "Draft values for the decision form when staff start from a model."
  def draft(kind, outcome, appeal_by) do
    %{
      "outcome" => outcome,
      "response" => text(kind, outcome, "response", appeal_by) || "",
      "reporter_response" => text(kind, outcome, "reporter_response", appeal_by) || ""
    }
  end

  defp contact do
    case Cherry.Instance.info().contact_email do
      email when is_binary(email) and email != "" -> email
      _ -> "[CORREO DE CONTACTO]"
    end
  end
end
