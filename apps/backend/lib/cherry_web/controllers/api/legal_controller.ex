defmodule CherryWeb.Controllers.Api.LegalController do
  use CherryWeb, :controller

  def show(conn, _) do
    json(conn, %{
      publication: Cherry.Legal.Policy.publication(),
      status: Cherry.Legal.status(conn.assigns.current_user)
    })
  end

  def create(conn, params) do
    case Cherry.Legal.accept(conn.assigns.current_user, params) do
      {:ok, receipt} ->
        json(conn, %{
          accepted: true,
          version: receipt.version,
          fingerprint: receipt.fingerprint,
          acceptedAt: receipt.terms_accepted_at
        })

      {:error, :legal_not_ready} ->
        conn |> put_status(:service_unavailable) |> json(%{error: "legal_not_ready"})

      {:error, :policy_changed} ->
        conn |> put_status(:conflict) |> json(%{error: "policy_changed"})

      {:error, _} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "explicit_declarations_required"})
    end
  end
end
