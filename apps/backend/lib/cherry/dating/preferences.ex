defmodule Cherry.Dating.Preferences do
  @moduledoc "Discovery preference persistence and changesets."

  alias Cherry.Repo
  alias Cherry.Dating.DiscoveryPreference

  # ── Discovery Preferences ─────────────────────────────────────────────

  @doc """
  Gets discovery preferences for a profile.
  """
  def get_discovery_preference(profile_id) do
    Repo.get_by(DiscoveryPreference, profile_id: profile_id)
  end

  @doc """
  Inserts or updates discovery preferences for a profile.
  """
  def upsert_discovery_preference(profile_id, attrs) do
    case get_discovery_preference(profile_id) do
      nil ->
        %DiscoveryPreference{profile_id: profile_id}
        |> DiscoveryPreference.changeset(attrs)
        |> Repo.insert()

      pref ->
        pref
        |> DiscoveryPreference.changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for discovery preference changes.
  """
  def change_discovery_preference(%DiscoveryPreference{} = pref, attrs \\ %{}) do
    DiscoveryPreference.changeset(pref, attrs)
  end
end
