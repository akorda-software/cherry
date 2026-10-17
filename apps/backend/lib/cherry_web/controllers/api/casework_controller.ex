defmodule CherryWeb.Controllers.Api.CaseworkController do
  use CherryWeb, :controller
  alias Cherry.Casework

  plug(:private_response)

  def index(conn, params) do
    user = conn.assigns.current_user
    records = Casework.list_for_user(user, Casework.offset(params))
    appealed = Casework.appealed_ids(user, records)
    json(conn, %{cases: Enum.map(records, &serialize(&1, user.id, appealed))})
  end

  def show(conn, %{"id" => id}) do
    case Casework.get_for_user(conn.assigns.current_user, id) do
      {:ok, record} ->
        json(conn, %{
          case:
            serialize(
              record,
              conn.assigns.current_user.id,
              Casework.appealed_ids(conn.assigns.current_user, [record])
            )
        })

      error ->
        failure(conn, error)
    end
  end

  def create(conn, params), do: respond(conn, Casework.submit(conn.assigns.current_user, params))

  def appeal(conn, %{"id" => id} = params),
    do: respond(conn, Casework.appeal(conn.assigns.current_user, id, params))

  def notices(conn, params) do
    notices = Casework.notices(conn.assigns.current_user, Casework.offset(params))

    json(conn, %{
      notices:
        Enum.map(notices, fn notice ->
          %{
            id: notice.id,
            caseId: notice.case_id,
            event: notice.event,
            message: notice.message,
            readAt: notice.read_at,
            insertedAt: notice.inserted_at
          }
        end)
    })
  end

  def read_notice(conn, %{"id" => id}) do
    case Casework.read_notice(conn.assigns.current_user, id) do
      {:ok, _} -> json(conn, %{ok: true})
      error -> failure(conn, error)
    end
  end

  defp respond(conn, {:ok, record}),
    do:
      conn
      |> put_status(:created)
      |> json(%{case: serialize(record, conn.assigns.current_user.id)})

  defp respond(conn, error), do: failure(conn, error)

  defp serialize(record, user_id, appealed \\ MapSet.new()) do
    # Neither reporter identity, staff identifiers nor internal audit ever leave this boundary.
    owner? = record.requester_user_id == user_id

    %{
      id: record.id,
      kind: record.kind,
      category: record.category,
      status: record.status,
      statement: if(owner?, do: record.statement),
      outcome: record.outcome,
      response:
        if(owner? and record.kind == "report",
          do: record.reporter_response,
          else: record.response
        ),
      insertedAt: record.inserted_at,
      resolvedAt: record.resolved_at,
      canAppeal:
        record.status == "resolved" and record.kind in ~w(report complaint measure) and
          not MapSet.member?(appealed, record.id)
    }
  end

  defp failure(conn, {:error, :not_found}),
    do: conn |> put_status(:not_found) |> json(%{error: "case_not_found"})

  defp failure(conn, {:error, :rate_limited}),
    do: conn |> put_status(:too_many_requests) |> json(%{error: "case_rate_limited"})

  defp failure(conn, {:error, %Ecto.Changeset{} = changeset}),
    do:
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{errors: CherryWeb.ChangesetJSON.errors(changeset)})

  defp failure(conn, _), do: conn |> put_status(:conflict) |> json(%{error: "case_conflict"})
  defp private_response(conn, _), do: put_resp_header(conn, "cache-control", "no-store")
end
