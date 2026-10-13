defmodule Cherry.Dating.Profiles do
  @moduledoc """
  Profile lifecycle, onboarding completeness and visibility state.

  `is_discoverable` (shown to others) requires a complete profile, not paused
  by its owner, not deleted and, while age verification is mandatory, a valid
  verification (`Cherry.Identity.AgeVerifications.allows_discovery?/1`). An
  unverified profile is then "pending verification", which is not a pause.
  """

  alias Cherry.Repo
  alias Cherry.Dating.Profile
  alias Cherry.Identity.AgeVerifications

  # ── Profiles ──────────────────────────────────────────────────────────

  @doc """
  Returns the list of all profiles.
  """
  def list_profiles do
    Repo.all(Profile)
  end

  @doc """
  Gets a single profile by id.
  """
  def get_profile(id) do
    Repo.get(Profile, id)
  end

  @doc """
  Gets a single profile by user_id.
  """
  def get_profile_by_user(user_id) do
    Repo.get_by(Profile, user_id: user_id)
  end

  @doc """
  Creates a profile.
  """
  def create_profile(attrs \\ %{}) do
    %Profile{}
    |> Profile.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Creates or updates the current user's draft profile during onboarding.
  """
  def upsert_profile_for_user(user_id, attrs \\ %{}) do
    attrs = put_user_id(attrs, user_id)

    case get_profile_by_user(user_id) do
      nil ->
        %Profile{}
        |> Profile.draft_changeset(attrs)
        |> Repo.insert()

      %Profile{} = profile ->
        update_profile(profile, attrs)
    end
  end

  @doc """
  Updates a profile's core fields.
  """
  def update_profile(%Profile{} = profile, attrs) do
    profile
    |> Profile.draft_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Soft-deletes a profile by setting `deleted_at`.
  """
  def delete_profile(%Profile{} = profile) do
    profile
    |> Profile.system_changeset(%{deleted_at: DateTime.utc_now(), is_discoverable: false})
    |> Repo.update()
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking profile changes.
  """
  def change_profile(%Profile{} = profile, attrs \\ %{}) do
    Profile.changeset(profile, attrs)
  end

  def profile_completion_missing(%Profile{} = profile) do
    profile = Repo.preload(profile, [:photos, :tags, :discovery_preference, :location])

    strict = Application.get_env(:cherry, :strict_profile_completion, true)

    base_checks = [
      {:display_name, present_string?(profile.display_name)},
      {:birth_date, valid_age?(profile)},
      {:gender, profile.gender in Profile.genders()},
      {:looking_for, Profile.valid_looking_for?(profile.looking_for)},
      {:bio, valid_bio?(profile.bio)},
      {:interested_in, valid_interested_in?(profile.discovery_preference)},
      {:discovery_preferences, valid_discovery_preferences?(profile.discovery_preference)},
      {:tags, valid_tag_count?(profile.tags)}
    ]

    extra_checks =
      if strict do
        [{:photos, valid_photo_count?(profile.photos)}, {:location, profile.location != nil}]
      else
        []
      end

    (base_checks ++ extra_checks)
    |> Enum.reject(fn {_field, valid?} -> valid? end)
    |> Enum.map(fn {field, _valid?} -> field end)
  end

  @doc """
  Checks whether a profile satisfies completeness rules.

  Rules:
  - 2–4 active photos
  - bio between 20 and 240 characters
  - discovery preferences present with at least one interested-in option
  - 1–8 positive tags
  - location present
  """
  def profile_complete?(%Profile{} = profile) do
    profile_completion_missing(profile) == []
  end

  @doc """
  Marks `is_complete` true if completeness rules pass.
  """
  def set_profile_complete(%Profile{} = profile) do
    complete = profile_complete?(profile)

    profile
    |> Profile.system_changeset(%{
      is_complete: complete,
      is_discoverable: complete and discoverable?(profile)
    })
    |> Repo.update()
  end

  def complete_profile(%Profile{} = profile) do
    missing = profile_completion_missing(profile)

    if missing == [] do
      profile
      |> Profile.system_changeset(%{
        is_complete: true,
        is_discoverable: discoverable?(profile),
        # First completion only: drives the discovery newcomer boost.
        completed_at: profile.completed_at || now()
      })
      |> Repo.update()
    else
      {:error,
       %{
         error: :profile_incomplete,
         missing: missing,
         next_onboarding_step: next_onboarding_step(missing)
       }}
    end
  end

  def sync_completed_profile_state(%Profile{is_complete: true} = profile) do
    set_profile_complete(profile)
  end

  def sync_completed_profile_state(%Profile{} = profile), do: {:ok, profile}

  @doc """
  Pauses a profile (sets `is_paused` true and `is_discoverable` false).
  """
  def pause_profile(%Profile{} = profile) do
    profile
    |> Profile.system_changeset(%{is_paused: true, is_discoverable: false})
    |> Repo.update()
  end

  @doc """
  Unpauses a profile (sets `is_paused` false).
  """
  def unpause_profile(%Profile{} = profile) do
    profile
    |> Profile.system_changeset(%{is_paused: false})
    |> Repo.update()
  end

  # Everything but completeness; the verification is only looked up when the
  # rest already holds.
  defp discoverable?(%Profile{} = profile) do
    !profile.is_paused and is_nil(profile.deleted_at) and
      AgeVerifications.allows_discovery?(profile.user_id)
  end

  defp put_user_id(attrs, user_id) when is_map(attrs) do
    if Enum.any?(Map.keys(attrs), &is_binary/1) do
      Map.put(attrs, "user_id", user_id)
    else
      Map.put(attrs, :user_id, user_id)
    end
  end

  defp present_string?(value) when is_binary(value), do: String.trim(value) != ""
  defp present_string?(_value), do: false

  defp valid_bio?(value) when is_binary(value) do
    length = value |> String.trim() |> String.length()
    length >= 20 and length <= 240
  end

  defp valid_bio?(_value), do: false

  defp valid_age?(%Profile{} = profile) do
    case Profile.age(profile) do
      age when is_integer(age) -> age >= 18
      _age -> false
    end
  end

  defp valid_photo_count?(photos) when is_list(photos) do
    active_photos = Enum.count(photos, & &1.is_active)
    active_photos >= 2 and active_photos <= 4
  end

  defp valid_photo_count?(_photos), do: false

  defp valid_interested_in?(nil), do: false

  defp valid_interested_in?(pref) do
    pref.show_men or pref.show_women or pref.show_non_binary
  end

  defp valid_discovery_preferences?(nil), do: false

  defp valid_discovery_preferences?(pref) do
    valid_interested_in?(pref) and pref.age_min <= pref.age_max and
      pref.distance_km in [10, 25, 50, 100, 999_999]
  end

  defp valid_tag_count?(tags) when is_list(tags), do: length(tags) >= 1 and length(tags) <= 8
  defp valid_tag_count?(_tags), do: false

  defp next_onboarding_step([:display_name | _missing]), do: "name"
  defp next_onboarding_step([:birth_date | _missing]), do: "birth_date"
  defp next_onboarding_step([:gender | _missing]), do: "gender"
  defp next_onboarding_step([:looking_for | _missing]), do: "intent"
  defp next_onboarding_step([:bio | _missing]), do: "bio"
  defp next_onboarding_step([:photos | _missing]), do: "photos"
  defp next_onboarding_step([:interested_in | _missing]), do: "interested_in"
  defp next_onboarding_step([:discovery_preferences | _missing]), do: "discovery_preferences"
  defp next_onboarding_step([:tags | _missing]), do: "tags"
  defp next_onboarding_step([:location | _missing]), do: "location"
  defp next_onboarding_step(_missing), do: nil

  @doc """
  Disables a profile (admin action).
  Sets `is_discoverable` false and `is_paused` true.
  """
  def disable_profile(%Profile{} = profile) do
    profile
    |> Profile.system_changeset(%{is_discoverable: false, is_paused: true})
    |> Repo.update()
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
