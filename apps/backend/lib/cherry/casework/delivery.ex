defmodule Cherry.Casework.Delivery do
  @moduledoc "Transactional private receipts and decisions; no network delivery or account measures."
  alias Cherry.Casework.{Case, Notice}
  alias Cherry.Repo

  def resolution!(%Case{kind: "measure"} = record),
    do: notice!(record, record.subject_user_id, "resolved", record.response)

  def resolution!(%Case{kind: "report"} = record) do
    notice!(record, record.requester_user_id, "resolved", record.reporter_response)

    if record.outcome != "dismissed",
      do: notice!(record, record.subject_user_id, "resolved", record.response)
  end

  def resolution!(record),
    do: notice!(record, record.requester_user_id, "resolved", record.response)

  def receipt!(record, user_id),
    do:
      notice!(
        record,
        user_id,
        "received",
        "Hemos recibido tu solicitud. Puedes consultar aquí su estado y la respuesta del equipo."
      )

  def retained_review!(record),
    do:
      notice!(
        record,
        record.requester_user_id,
        "received",
        "Tu solicitud de revisión sigue pendiente en esta ficha mínima. No necesitas volver a presentarla; no se conserva el texto anterior ni datos de otras personas."
      )

  def reopened!(record),
    do:
      notice!(
        record,
        record.requester_user_id,
        "received",
        "Tu recurso ha abierto una nueva revisión. Puedes seguir este nuevo expediente en el buzón."
      )

  defp notice!(_record, nil, _event, _message), do: :ok

  defp notice!(record, user_id, event, message),
    do:
      Repo.insert!(%Notice{case_id: record.id, user_id: user_id, event: event, message: message},
        log: false
      )
end
