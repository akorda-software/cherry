defmodule CherryWeb.Controllers.Api.BootstrapController do
  use CherryWeb, :controller

  alias Cherry.Dating

  def show(conn, _params) do
    user = conn.assigns.current_user
    profile = conn.assigns.current_profile

    profile_state =
      if profile do
        complete = Dating.profile_complete?(profile)
        missing = Dating.profile_completion_missing(profile)

        %{
          exists: true,
          isComplete: complete,
          isDiscoverable: profile.is_discoverable,
          isPaused: profile.is_paused,
          onboardingRequired: !complete,
          nextOnboardingStep: next_onboarding_step(missing)
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

  defp next_onboarding_step([:display_name | _missing]), do: "name"
  defp next_onboarding_step([:birth_date | _missing]), do: "birth_date"
  defp next_onboarding_step([:gender | _missing]), do: "gender"
  defp next_onboarding_step([:what_i_am_looking_for | _missing]), do: "intent"
  defp next_onboarding_step([:bio | _missing]), do: "bio"
  defp next_onboarding_step([:photos | _missing]), do: "photos"
  defp next_onboarding_step([:interested_in | _missing]), do: "interested_in"
  defp next_onboarding_step([:discovery_preferences | _missing]), do: "discovery_preferences"
  defp next_onboarding_step([:tags | _missing]), do: "tags"
  defp next_onboarding_step([:location | _missing]), do: "location"
  defp next_onboarding_step(_missing), do: nil
end
