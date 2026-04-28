defmodule SnackWeb.Controllers.Api.BootstrapController do
  use SnackWeb, :controller

  alias Snack.Dating

  def show(conn, _params) do
    user = conn.assigns.current_user
    profile = conn.assigns.current_profile

    profile_state =
      if profile do
        complete = Dating.profile_complete?(profile)

        %{
          exists: true,
          isComplete: complete,
          isDiscoverable: profile.is_discoverable,
          isPaused: profile.is_paused
        }
      else
        %{
          exists: false,
          isComplete: false,
          isDiscoverable: false,
          isPaused: false
        }
      end

    json(conn, %{
      user: %{
        id: user.id,
        email: user.email,
        displayName: user.display_name
      },
      profile: profile_state
    })
  end
end
