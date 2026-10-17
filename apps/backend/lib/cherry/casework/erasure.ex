defmodule Cherry.Casework.Erasure do
  @moduledoc "Keeps only another account's live measure and review, never the erased party's evidence or identity."
  import Ecto.Query
  alias Cherry.Accounts.User
  alias Cherry.Casework.{Audit, Case, Delivery}
  alias Cherry.Repo

  @measure_response "Tu cuenta sigue suspendida. Esta ficha conserva únicamente la medida vigente y su vía de revisión, sin el relato ni datos de otras personas. Aquí puedes consultar las opciones de revisión humana disponibles."
  @review_statement "Solicitud de revisión ya presentada, trasladada a una ficha mínima. No se conserva su texto anterior ni datos de otras personas."
  @review_response "Esta ficha conserva únicamente el resultado de la revisión humana, sin el relato ni datos de otras personas."

  # Called under Lifecycle.erase!, before deleting the user. No external I/O.
  def prepare!(user_id) do
    affected_ids = affected_ids(user_id)

    sources =
      Repo.all(
        from(c in Case,
          where: c.id in ^affected_ids,
          order_by: c.id,
          lock: "FOR NO KEY UPDATE",
          select: map(c, [:id, :decided_by_staff_id, :resolved_at])
        )
      )
      |> Map.new(&{&1.id, &1})

    # Fixed account order also covers concurrent deletion of both parties.
    users =
      Repo.all(
        from(u in User,
          where: u.id == ^user_id or u.suspension_case_id in ^affected_ids,
          order_by: u.id,
          lock: "FOR NO KEY UPDATE"
        ),
        log: false
      )

    for user <- users,
        user.id != user_id and not is_nil(user.suspended_at) and
          not is_nil(user.suspension_case_id) do
      preserve!(user, Map.fetch!(sources, user.suspension_case_id))
    end

    :ok
  end

  defp affected_ids(user_id) do
    %{rows: rows} =
      Repo.query!(
        """
        WITH RECURSIVE affected(id) AS (
          SELECT id FROM casework_cases WHERE requester_user_id = $1 OR subject_user_id = $1
          UNION
          SELECT c.id FROM casework_cases c JOIN affected a ON c.parent_case_id = a.id
        )
        SELECT id FROM affected
        """,
        [Ecto.UUID.dump!(user_id)],
        log: false
      )

    Enum.map(rows, fn [id] -> Ecto.UUID.load!(id) end)
  end

  defp preserve!(user, source) do
    measure =
      Repo.insert!(
        %Case{
          kind: "measure",
          category: "safety",
          status: "resolved",
          subject_user_id: user.id,
          outcome: "suspend",
          response: @measure_response,
          decided_by_staff_id: source.decided_by_staff_id,
          resolved_at: source.resolved_at || user.suspended_at
        },
        log: false
      )

    # Transfer the reference, not the decision: no new suspension/restoration,
    # no reset of suspended_at and no automatic change of discoverability.
    Repo.update!(Ecto.Changeset.change(user, suspension_case_id: measure.id), log: false)
    Delivery.resolution!(measure)

    Audit.record!("measure_preserved", %{
      case_id: measure.id,
      user_id: user.id,
      staff_id: source.decided_by_staff_id
    })

    reviews =
      Repo.all(
        from(c in Case,
          where:
            c.parent_case_id == ^source.id and c.kind == "appeal" and
              c.requester_user_id == ^user.id,
          select:
            map(c, [
              :status,
              :outcome,
              :assigned_staff_id,
              :decided_by_staff_id,
              :resolved_at,
              :inserted_at
            ])
        ),
        log: false
      )

    for review <- reviews, do: preserve_review!(review, measure)
  end

  defp preserve_review!(review, measure) do
    record =
      Repo.insert!(
        struct!(
          Case,
          Map.merge(review, %{
            kind: "appeal",
            category: "safety",
            parent_case_id: measure.id,
            requester_user_id: measure.subject_user_id,
            subject_user_id: measure.subject_user_id,
            statement: @review_statement,
            response: if(review.status == "resolved", do: @review_response)
          })
        ),
        log: false
      )

    if record.status == "resolved",
      do: Delivery.resolution!(record),
      else: Delivery.retained_review!(record)

    Audit.record!("measure_review_preserved", %{
      case_id: record.id,
      user_id: record.requester_user_id
    })
  end
end
