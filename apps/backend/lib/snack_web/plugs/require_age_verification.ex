defmodule SnackWeb.Plugs.RequireAgeVerification do
  @moduledoc """
  Blocks the social API for users without a valid age verification when the
  `:age_verification_required` flag is on (`AGE_VERIFICATION_REQUIRED`, off by
  default). With the flag off it does nothing.

  Responds 403 `{"error": "age_verification_required"}`. Profile editing,
  bootstrap, the verification itself, blocking and reporting stay reachable.
  """

  import Plug.Conn

  alias Snack.Identity.AgeVerifications

  def init(opts), do: opts

  def call(conn, _opts) do
    user = conn.assigns[:current_user]

    if AgeVerifications.required?() and not (user && AgeVerifications.verified?(user.id)) do
      conn
      |> put_status(:forbidden)
      |> Phoenix.Controller.json(%{error: "age_verification_required"})
      |> halt()
    else
      conn
    end
  end
end
