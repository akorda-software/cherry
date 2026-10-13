defmodule CherryWeb.Controllers.Api.PublicProfileController do
  use CherryWeb, :controller

  alias Cherry.Dating.Social
  alias CherryWeb.ProfileCardJSON

  @doc "Perfil público de otra persona; 404 si no es visible para el viewer."
  def show(conn, %{"id" => profile_id}) do
    with %{} = viewer <- conn.assigns.current_profile,
         {:ok, %{row: row, media: media, match: match}} <-
           Social.public_profile(viewer, profile_id) do
      json(conn, %{profile: ProfileCardJSON.public_profile(conn, row, media, match)})
    else
      _not_found -> conn |> put_status(:not_found) |> json(%{error: "profile_not_found"})
    end
  end
end
