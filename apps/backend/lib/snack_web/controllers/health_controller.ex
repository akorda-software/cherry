defmodule SnackWeb.HealthController do
  use SnackWeb, :controller

  def healthz(conn, _params) do
    json(conn, %{status: "ok", version: app_version()})
  end

  def readyz(conn, _params) do
    case Ecto.Adapters.SQL.query(Snack.Repo, "SELECT 1") do
      {:ok, _result} ->
        json(conn, %{status: "ready", version: app_version()})

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{status: "unavailable"})
    end
  end

  defp app_version, do: Application.get_env(:snack, :app_version, "dev")
end
