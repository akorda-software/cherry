defmodule Cherry.Dating.Matching do
  @moduledoc "Atomic swipes, reciprocal matching and match lifecycle."

  import Ecto.Query

  alias Cherry.Repo
  alias Cherry.Dating.SwipeAction
  alias Cherry.Dating.Match
  alias Cherry.Dating.Conversation
  alias Cherry.Dating.UserBlock
  alias Cherry.Dating.PairLock

  # ── Swipes & Matching ─────────────────────────────────────────────────

  @doc """
  Records a swipe action.

  On a "like", if the target already liked the actor, creates a `Match`
  and a `Conversation`. Sets `expires_at` to matched_at + `Cherry.Dating.MatchExpiry.days/0`
  (30 by default, D-2026-09-29). Swipes of the same pair are serialised (advisory
  lock), so two simultaneous likes always produce exactly one match.

  Returns `{:ok, %{swipe: SwipeAction.t(), match: Match.t() | nil}}`.
  """
  def record_swipe(attrs) do
    actor_id = attrs["actor_profile_id"] || attrs[:actor_profile_id]
    target_id = attrs["target_profile_id"] || attrs[:target_profile_id]
    action_type = attrs["action_type"] || attrs[:action_type]

    Ecto.Multi.new()
    |> Ecto.Multi.run(:pair_lock, fn repo, _changes ->
      PairLock.lock(repo, actor_id, target_id)
    end)
    # Revalidated under the pair lock, which `block_profile/1` also takes: a
    # block committed while this swipe waited always wins.
    |> Ecto.Multi.run(:not_blocked, fn repo, _changes ->
      if pair_blocked?(repo, actor_id, target_id) or pair_suspended?(repo, actor_id, target_id),
        do: {:error, :blocked},
        else: {:ok, nil}
    end)
    |> Ecto.Multi.insert(:swipe, fn _changes ->
      %SwipeAction{}
      |> SwipeAction.changeset(attrs)
    end)
    |> Ecto.Multi.run(:match, fn _repo, %{swipe: _swipe} ->
      if action_type == "like" do
        reverse_like =
          Repo.one(
            from(s in SwipeAction,
              where:
                s.actor_profile_id == ^target_id and
                  s.target_profile_id == ^actor_id and
                  s.action_type == "like"
            )
          )

        if reverse_like do
          create_match_and_conversation(actor_id, target_id)
        else
          {:ok, nil}
        end
      else
        {:ok, nil}
      end
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{swipe: swipe, match: match}} ->
        {:ok, %{swipe: swipe, match: match}}

      {:error, :swipe, changeset, _changes} ->
        {:error, changeset}

      {:error, step, reason, _changes} when step in [:pair_lock, :not_blocked, :match] ->
        {:error, reason}
    end
  end

  defp pair_blocked?(repo, a, b) do
    with {:ok, a} <- Ecto.UUID.cast(a),
         {:ok, b} <- Ecto.UUID.cast(b) do
      repo.exists?(
        from(block in UserBlock,
          where:
            (block.actor_profile_id == ^a and block.target_profile_id == ^b) or
              (block.actor_profile_id == ^b and block.target_profile_id == ^a)
        )
      )
    else
      # Invalid ids fail later in the swipe changeset.
      :error -> false
    end
  end

  defp pair_suspended?(repo, a, b) do
    with {:ok, a} <- Ecto.UUID.cast(a), {:ok, b} <- Ecto.UUID.cast(b) do
      # User locks serialize restriction with writes that passed an earlier REST check.
      users =
        repo.all(
          from(u in Cherry.Accounts.User,
            where:
              u.id in subquery(
                from(p in Cherry.Dating.Profile, where: p.id in ^[a, b], select: p.user_id)
              ),
            order_by: u.id,
            lock: "FOR SHARE",
            select: u.suspended_at
          )
        )

      Enum.any?(users, &(!is_nil(&1)))
    else
      _ -> false
    end
  end

  defp create_match_and_conversation(actor_id, target_id) do
    {a_id, b_id} = if actor_id < target_id, do: {actor_id, target_id}, else: {target_id, actor_id}

    now = DateTime.utc_now() |> DateTime.truncate(:second)
    expires_at = Cherry.Dating.MatchExpiry.expires_at(now)

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:match, fn _changes ->
      %Match{}
      |> Match.changeset(%{
        profile_a_id: a_id,
        profile_b_id: b_id,
        status: "active",
        matched_at: now,
        expires_at: expires_at
      })
    end)
    |> Ecto.Multi.insert(:conversation, fn %{match: match} ->
      %Conversation{}
      |> Conversation.changeset(%{match_id: match.id})
    end)
    |> Ecto.Multi.run(:notifications, fn _repo, %{match: match} ->
      Cherry.Notifications.Outbox.enqueue_new_match(match)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{match: match}} -> {:ok, match}
      {:error, :match, changeset, _} -> {:error, changeset}
      {:error, :conversation, changeset, _} -> {:error, changeset}
      {:error, :notifications, changeset, _} -> {:error, changeset}
    end
  end

  @doc """
  Lists active, non-expired matches for a profile. For the enriched API listing
  (blocks, deleted accounts, last message, unread) see `Cherry.Dating.Inbox`.
  """
  def list_matches(profile_id) do
    now = now()

    Match
    |> where(
      [m],
      (m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id) and
        m.status == "active" and (is_nil(m.expires_at) or m.expires_at > ^now)
    )
    |> order_by([m], desc: m.matched_at)
    |> Repo.all()
  end

  @doc """
  Gets a single match by id.
  """
  def get_match(id) do
    Repo.get(Match, id)
  end

  @doc """
  Unmatches a match by id (sets status to `unmatched`).
  """
  def unmatch(match_id) do
    match = Repo.get!(Match, match_id)

    match
    |> Match.changeset(%{status: "unmatched", unmatched_at: now()})
    |> Repo.update()
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
