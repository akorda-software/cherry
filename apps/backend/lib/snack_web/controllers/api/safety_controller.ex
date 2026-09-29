defmodule SnackWeb.Controllers.Api.SafetyController do
  use SnackWeb, :controller

  alias Snack.Dating.Safety

  def block(conn, %{"profile_id" => target_profile_id}) do
    profile = conn.assigns.current_profile

    with %{} <- profile,
         {:ok, _block} <- Safety.block(profile, target_profile_id) do
      json(conn, %{ok: true})
    else
      result -> error_response(conn, result)
    end
  end

  def report(conn, %{"profile_id" => target_profile_id} = params) do
    profile = conn.assigns.current_profile

    with %{} <- profile,
         {:ok, report} <-
           Safety.report(
             profile,
             target_profile_id,
             Map.get(params, "reason"),
             Map.get(params, "details")
           ) do
      json(conn, %{report: serialize_report(report)})
    else
      result -> error_response(conn, result)
    end
  end

  defp error_response(conn, nil), do: not_found(conn)
  defp error_response(conn, {:error, :profile_not_found}), do: not_found(conn)

  defp error_response(conn, {:error, reason}) when is_atom(reason) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
  end

  defp error_response(conn, {:error, changeset}) do
    conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
  end

  defp not_found(conn) do
    conn |> put_status(:not_found) |> json(%{error: "profile_not_found"})
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
