defmodule Cherry.Casework.Resolution do
  @moduledoc "Applies a validated human decision; preserves prior decisions and uses account-owned restrictions."
  import Ecto.Query
  alias Cherry.Accounts.Restrictions
  alias Cherry.Casework.{Audit, Case, Delivery}
  alias Cherry.Dating.Report
  alias Cherry.Repo

  def apply!(%Case{kind: "report"} = record) do
    if record.outcome == "suspend", do: Restrictions.suspend!(record.subject_user_id, record.id)

    if record.report_id do
      status = if record.outcome == "dismissed", do: "dismissed", else: "actioned"
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      Repo.update_all(from(r in Report, where: r.id == ^record.report_id),
        set: [status: status, reviewed_at: now, updated_at: now]
      )
    end
  end

  def apply!(%Case{kind: "appeal", outcome: "overturned"} = record) do
    parent = Repo.get(Case, record.parent_case_id) || Repo.rollback(:parent_unavailable)

    cond do
      parent.kind in ~w(report measure) and record.requester_user_id == parent.subject_user_id ->
        if parent.outcome == "suspend",
          do: Restrictions.restore!(parent.subject_user_id, parent.id)

      parent.kind in ~w(report complaint) ->
        reopen!(parent, record)

      true ->
        Repo.rollback(:not_appealable)
    end
  end

  def apply!(_), do: :ok

  defp reopen!(parent, appeal) do
    followup =
      Repo.insert!(
        %Case{
          kind: parent.kind,
          category: parent.category,
          statement: parent.statement,
          requester_user_id: parent.requester_user_id,
          subject_user_id: parent.subject_user_id,
          parent_case_id: parent.id
        },
        log: false
      )

    Delivery.reopened!(followup)

    Audit.record!("case_reopened", %{
      case_id: followup.id,
      staff_id: appeal.decided_by_staff_id,
      metadata: %{original_case_id: parent.id, appeal_case_id: appeal.id}
    })
  end
end
