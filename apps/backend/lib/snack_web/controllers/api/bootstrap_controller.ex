defmodule SnackWeb.Controllers.Api.BootstrapController do
  use SnackWeb, :controller

  def show(conn, _params) do
    user = conn.assigns.current_user
    profile = conn.assigns.current_profile

    profile_state =
      if profile do
        {complete, next_step} = SnackWeb.Onboarding.state(profile)

        %{
          exists: true,
          isComplete: complete,
          isDiscoverable: profile.is_discoverable,
          isPaused: profile.is_paused,
          onboardingRequired: !complete,
          nextOnboardingStep: next_step
        }
      else
        %{
          exists: false,
          isComplete: false,
          isDiscoverable: false,
          isPaused: false,
          onboardingRequired: true,
          nextOnboardingStep: "name"
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
