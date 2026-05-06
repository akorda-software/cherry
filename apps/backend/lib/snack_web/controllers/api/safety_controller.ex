defmodule SnackWeb.Controllers.Api.SafetyController do
  use SnackWeb, :controller

  alias Snack.Dating

  def block(conn, %{"profile_id" => target_profile_id}) do
    profile = conn.assigns.current_profile

    if profile do
      attrs = %{
        actor_profile_id: profile.id,
        target_profile_id: target_profile_id
      }

      case Dating.block_profile(attrs) do
        {:ok, _} ->
          json(conn, %{ok: true})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def report(conn, %{"profile_id" => target_profile_id} = params) do
    profile = conn.assigns.current_profile

    if profile do
      attrs = %{
        reporter_profile_id: profile.id,
        target_profile_id: target_profile_id,
        reason: Map.get(params, "reason", ""),
        details: Map.get(params, "details")
      }

      case Dating.report_profile(attrs) do
        {:ok, report} ->
          json(conn, %{report: serialize_report(report)})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  defp serialize_report(report) do
    %{
      id: report.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      insertedAt: report.inserted_at
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
