defmodule CherryWeb.Controllers.Api.BootstrapController do
  use CherryWeb, :controller

  alias Cherry.Identity.AgeVerifications

  def show(conn, _params) do
    user = conn.assigns.current_user
    profile = conn.assigns.current_profile

    profile_state =
      if profile do
        {complete, next_step} = CherryWeb.Onboarding.state(profile)

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
      legal: Cherry.Legal.status(user),
      user: %{
        id: user.id,
        email: user.email,
        displayName: user.display_name
      },
      profile: profile_state,
      ageVerification: %{
        required: AgeVerifications.required?(),
        status: AgeVerifications.status(user.id),
        providerAvailable: AgeVerifications.provider_available?(),
        providerLimitReached: AgeVerifications.provider_limit_reached?()
      }
    })
  end
end
