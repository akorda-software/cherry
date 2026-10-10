defmodule CherryWeb.HealthController do
  use CherryWeb, :controller

  def healthz(conn, _params) do
    json(conn, %{status: "ok", version: app_version()})
  end

  def readyz(conn, _params) do
    case Ecto.Adapters.SQL.query(Cherry.Repo, "SELECT 1") do
      {:ok, _result} ->
        json(conn, %{status: "ready", version: app_version()})

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{status: "unavailable"})
    end
  end

  defp app_version, do: Application.get_env(:cherry, :app_version, "dev")
end
