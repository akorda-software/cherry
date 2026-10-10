defmodule Cherry.Dating.Tags do
  @moduledoc "Tag catalog and mutually exclusive positive/blocked profile selections."

  import Ecto.Query

  alias Cherry.Repo
  alias Cherry.Dating.Profile
  alias Cherry.Dating.Tag

  # ── Tags ──────────────────────────────────────────────────────────────

  @doc """
  Lists all active tags in catalog order (`sort_order` is global and already
  groups categories in their display order).
  """
  def list_active_tags do
    Tag
    |> where([t], t.is_active == true)
    |> order_by([t], [t.sort_order, t.category, t.label])
    |> Repo.all()
  end

  @doc """
  Gets a single tag by id.
  """
  def get_tag(id) do
    Repo.get(Tag, id)
  end

  @doc """
  Creates a tag.
  """
  def create_tag(attrs \\ %{}) do
    %Tag{}
    |> Tag.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Replaces the positive tags on a profile (max 8, duplicates ignored).

  Errors: `:too_many_tags`; `{:invalid_tags, ids}` for unknown, malformed or
  inactive catalog IDs; `{:tag_conflict, ids}` for IDs the profile blocks.
  """
  def set_profile_tags(profile_id, tag_ids),
    do: replace_profile_tags(profile_id, tag_ids, :tags)

  @doc """
  Replaces the blocked tags on a profile (max 5, duplicates ignored).

  Errors: `:too_many_blocked_tags`; `{:invalid_tags, ids}`; `{:tag_conflict, ids}`
  for IDs that are among the profile's positive tags.
  """
  def set_profile_blocked_tags(profile_id, tag_ids),
    do: replace_profile_tags(profile_id, tag_ids, :blocked_tags)

  defp replace_profile_tags(profile_id, tag_ids, assoc) do
    {max_tags, too_many, opposite_assoc} =
      case assoc do
        :tags -> {8, :too_many_tags, :blocked_tags}
        :blocked_tags -> {5, :too_many_blocked_tags, :tags}
      end

    with {:ok, ids} <- normalize_tag_ids(tag_ids),
         :ok <- if(length(ids) <= max_tags, do: :ok, else: {:error, too_many}) do
      Repo.transaction(fn ->
        # Serialises positive/blocked updates so a conflict can never slip in.
        profile =
          from(p in Profile, where: p.id == ^profile_id, lock: "FOR UPDATE")
          |> Repo.one!()
          |> Repo.preload([assoc, opposite_assoc])

        tags = Repo.all(from t in Tag, where: t.id in ^ids and t.is_active == true)
        found_ids = MapSet.new(tags, & &1.id)
        opposite_ids = MapSet.new(Map.fetch!(profile, opposite_assoc), & &1.id)
        invalid = Enum.reject(ids, &MapSet.member?(found_ids, &1))
        conflicting = Enum.filter(ids, &MapSet.member?(opposite_ids, &1))

        cond do
          invalid != [] ->
            Repo.rollback({:invalid_tags, invalid})

          conflicting != [] ->
            Repo.rollback({:tag_conflict, conflicting})

          true ->
            profile
            |> Ecto.Changeset.change()
            |> Ecto.Changeset.put_assoc(assoc, tags)
            |> Repo.update()
            |> case do
              {:ok, updated} -> updated
              {:error, changeset} -> Repo.rollback(changeset)
            end
        end
      end)
    end
  end

  defp normalize_tag_ids(tag_ids) when is_list(tag_ids) do
    {valid, invalid} =
      tag_ids
      |> Enum.map(fn id ->
        case is_binary(id) && Ecto.UUID.cast(id) do
          {:ok, uuid} -> {:ok, uuid}
          _invalid -> {:invalid, id}
        end
      end)
      |> Enum.split_with(&match?({:ok, _uuid}, &1))

    case invalid do
      [] -> {:ok, valid |> Enum.map(&elem(&1, 1)) |> Enum.uniq()}
      _invalid -> {:error, {:invalid_tags, Enum.map(invalid, &elem(&1, 1))}}
    end
  end

  defp normalize_tag_ids(_tag_ids), do: {:error, {:invalid_tags, []}}

  @doc """
  Returns the positive tags for a profile.
  """
  def get_profile_tags(profile_id) do
    profile = Repo.get!(Profile, profile_id) |> Repo.preload(:tags)
    profile.tags
  end

  @doc """
  Returns the blocked tags for a profile.
  """
  def get_profile_blocked_tags(profile_id) do
    profile = Repo.get!(Profile, profile_id) |> Repo.preload(:blocked_tags)
    profile.blocked_tags
  end
end
