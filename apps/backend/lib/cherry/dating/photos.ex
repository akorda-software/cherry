defmodule Cherry.Dating.Photos do
  @moduledoc "Active profile photos: listing, creation, deletion and ordering."

  import Ecto.Query

  alias Cherry.Repo
  alias Cherry.Dating.Profile
  alias Cherry.Dating.ProfilePhoto

  # ── Photos ────────────────────────────────────────────────────────────

  @doc """
  Lists active photos for a profile, ordered by position.
  """
  def list_photos(profile_id) do
    active_query()
    |> where([p], p.profile_id == ^profile_id)
    |> order_by([p], p.position)
    |> Repo.all()
  end

  @doc "Active-only query for lists and preloads, excluding soft-deleted history."
  def active_query, do: from(p in ProfilePhoto, where: p.is_active == true)

  @doc """
  Creates a photo.
  """
  def create_photo(attrs \\ %{}) do
    %ProfilePhoto{}
    |> ProfilePhoto.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Deletes a photo: the row is kept inactive (`is_active` false) and the stored
  object is deleted physically right away (retried by the sweeper if storage
  fails, see `Cherry.Dating.PhotoStorage`).
  """
  def delete_photo(%ProfilePhoto{} = photo) do
    with :ok <- Cherry.Recovery.Journal.record("photo", photo.id),
         :ok <- Cherry.Recovery.Journal.record("storage", photo.storage_key) do
      photo
      |> ProfilePhoto.changeset(%{is_active: false})
      |> Repo.update()
      |> case do
        {:ok, photo} -> {:ok, Cherry.Dating.PhotoStorage.purge_photo(photo)}
        error -> error
      end
    end
  end

  @doc """
  Reorders the active photos of a profile. `ordered_photo_ids` must list every
  active photo exactly once; positions become 1..n in that order.
  """
  def reorder_photos(profile_id, ordered_photo_ids) when is_list(ordered_photo_ids) do
    Repo.transaction(fn ->
      # Serialises with uploads/deletes of the same profile.
      Repo.one!(from(p in Profile, where: p.id == ^profile_id, lock: "FOR UPDATE"))

      active_query =
        from(p in ProfilePhoto, where: p.profile_id == ^profile_id and p.is_active == true)

      active_ids = Repo.all(from(p in active_query, select: p.id))

      if permutation?(ordered_photo_ids, active_ids) do
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        # Phase 1: park every active photo outside 1..4 so the partial unique
        # index on (profile_id, position) never sees a transient duplicate.
        Repo.update_all(active_query, inc: [position: 100])

        # Phase 2: final positions.
        ordered_photo_ids
        |> Enum.with_index(1)
        |> Enum.each(fn {photo_id, position} ->
          Repo.update_all(from(p in ProfilePhoto, where: p.id == ^photo_id),
            set: [position: position, updated_at: now]
          )
        end)

        list_photos(profile_id)
      else
        Repo.rollback(:invalid_photo_ids)
      end
    end)
  end

  def reorder_photos(_profile_id, _ordered_photo_ids), do: {:error, :invalid_photo_ids}

  defp permutation?(candidate_ids, expected_ids) do
    Enum.all?(candidate_ids, &is_binary/1) and length(candidate_ids) == length(expected_ids) and
      MapSet.new(candidate_ids) == MapSet.new(expected_ids)
  end
end
