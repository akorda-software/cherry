defmodule Cherry.Casework.Intake do
  @moduledoc "Creates cases and receipts atomically; no staff review or account measures."
  import Ecto.Query
  alias Cherry.Accounts.User
  alias Cherry.Casework.{Audit, Case, Delivery, Inbox}
  alias Cherry.Dating.{Profile, Report}
  alias Cherry.Repo

  @privacy_categories ~w(access rectification erasure restriction portability objection)
  def privacy_categories, do: @privacy_categories

  def intake_report!(%Report{} = report) do
    requester = Repo.get!(Profile, report.reporter_profile_id).user_id
    subject = Repo.get!(Profile, report.target_profile_id).user_id

    record =
      Repo.insert!(
        %Case{
          kind: "report",
          category: report.reason,
          statement: report.details,
          requester_user_id: requester,
          subject_user_id: subject,
          report_id: report.id
        },
        log: false
      )

    Delivery.receipt!(record, requester)
    Audit.record!("case_created", %{case_id: record.id, user_id: requester})
    record
  end

  def submit(%User{id: user_id}, attrs) do
    changeset = Case.request_changeset(%Case{requester_user_id: user_id}, attrs)
    changeset = Ecto.Changeset.validate_inclusion(changeset, :kind, ~w(privacy complaint))

    changeset =
      Ecto.Changeset.validate_inclusion(
        changeset,
        :category,
        if(Ecto.Changeset.get_field(changeset, :kind) == "privacy",
          do: @privacy_categories,
          else: ~w(service safety other)
        )
      )

    Repo.transaction(fn ->
      Cherry.Casework.Lifecycle.participate!()
      lock_requester!(user_id)

      count =
        Repo.aggregate(
          from(c in Case,
            where:
              c.requester_user_id == ^user_id and c.kind in ["privacy", "complaint"] and
                c.inserted_at > ^DateTime.add(now(), -86_400)
          ),
          :count
        )

      if count >= 10, do: Repo.rollback(:rate_limited)
      insert!(changeset, user_id, "case_created")
    end)
  end

  def appeal(%User{id: user_id} = user, id, attrs) do
    Repo.transaction(fn ->
      Cherry.Casework.Lifecycle.participate!()
      lock_requester!(user_id)

      parent =
        case Inbox.get_for_user(user, id) do
          {:ok, parent} -> parent
          _ -> Repo.rollback(:not_found)
        end

      if parent.status != "resolved" or parent.kind not in ~w(report complaint measure),
        do: Repo.rollback(:not_appealable)

      if Repo.get_by(Case, kind: "appeal", parent_case_id: parent.id, requester_user_id: user_id),
        do: Repo.rollback(:already_appealed)

      changeset =
        Case.request_changeset(
          %Case{
            requester_user_id: user_id,
            subject_user_id: parent.subject_user_id,
            parent_case_id: parent.id
          },
          Map.merge(Map.take(attrs, ["statement"]), %{
            "kind" => "appeal",
            "category" => parent.category
          })
        )

      insert!(changeset, user_id, "appeal_created")
    end)
  end

  defp insert!(changeset, user_id, action) do
    case Repo.insert(changeset, log: false) do
      {:ok, record} ->
        Delivery.receipt!(record, user_id)
        Audit.record!(action, %{case_id: record.id, user_id: user_id})
        record

      {:error, invalid} ->
        Repo.rollback(invalid)
    end
  end

  defp lock_requester!(id) do
    Repo.one(from(u in User, where: u.id == ^id and is_nil(u.deleted_at), lock: "FOR UPDATE")) ||
      Repo.rollback(:not_found)
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
