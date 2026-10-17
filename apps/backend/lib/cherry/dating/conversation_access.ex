defmodule Cherry.Dating.ConversationAccess do
  @moduledoc "Fresh conversation authorization shared by rich reads and scalar WS checks."

  import Ecto.Query

  alias Cherry.Accounts.User
  alias Cherry.Dating.{Conversation, Match, Profile, UserBlock}
  alias Cherry.Repo

  def get(conversation_id, profile_id) do
    with {:ok, conversation_id} <- Ecto.UUID.cast(conversation_id),
         {:ok, profile_id} <- Ecto.UUID.cast(profile_id) do
      available = pair_available()

      from([conversation: c, match: m] in query(conversation_id),
        select: %{conversation: c, match: m},
        select_merge: ^%{pair_allowed?: available}
      )
      |> Repo.one()
      |> authorize(profile_id)
    else
      :error -> {:error, :not_participant}
    end
  end

  def allowed?(conversation_id, profile_id) do
    with {:ok, conversation_id} <- Ecto.UUID.cast(conversation_id),
         {:ok, profile_id} <- Ecto.UUID.cast(profile_id) do
      available = pair_available()
      now = now()

      from([match: m] in query(conversation_id),
        where: ^available,
        where: m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id,
        where: m.status == "active" and (is_nil(m.expires_at) or m.expires_at > ^now)
      )
      |> Repo.exists?()
    else
      :error -> false
    end
  end

  @doc false
  def lock_accounts(conversation_id) do
    with {:ok, id} <- Ecto.UUID.cast(conversation_id) do
      user_ids =
        from([user_a: a, user_b: b] in query(id),
          select: fragment("unnest(ARRAY[?, ?])", a.id, b.id)
        )

      Repo.all(
        from(u in User,
          where: u.id in subquery(user_ids),
          order_by: u.id,
          lock: "FOR SHARE",
          select: u.id
        )
      )
    else
      _ -> []
    end
  end

  defp query(conversation_id) do
    from(c in Conversation,
      as: :conversation,
      join: m in Match,
      as: :match,
      on: m.id == c.match_id,
      join: a in Profile,
      as: :profile_a,
      on: a.id == m.profile_a_id,
      join: b in Profile,
      as: :profile_b,
      on: b.id == m.profile_b_id,
      join: ua in User,
      as: :user_a,
      on: ua.id == a.user_id,
      join: ub in User,
      as: :user_b,
      on: ub.id == b.user_id,
      where: c.id == ^conversation_id
    )
  end

  defp pair_available do
    blocked_pair =
      from(b in UserBlock,
        where:
          (b.actor_profile_id == parent_as(:match).profile_a_id and
             b.target_profile_id == parent_as(:match).profile_b_id) or
            (b.actor_profile_id == parent_as(:match).profile_b_id and
               b.target_profile_id == parent_as(:match).profile_a_id),
        select: 1
      )

    dynamic(
      [profile_a: a, profile_b: b, user_a: ua, user_b: ub],
      is_nil(a.deleted_at) and is_nil(b.deleted_at) and
        is_nil(ua.deleted_at) and is_nil(ub.deleted_at) and
        is_nil(ua.suspended_at) and is_nil(ub.suspended_at) and
        not exists(subquery(blocked_pair))
    )
  end

  defp authorize(nil, _profile_id), do: {:error, :not_participant}

  defp authorize(
         %{conversation: conversation, match: match, pair_allowed?: pair_allowed?},
         profile_id
       ) do
    cond do
      profile_id not in [match.profile_a_id, match.profile_b_id] ->
        {:error, :not_participant}

      not active?(match) or not pair_allowed? ->
        {:error, :conversation_not_active}

      true ->
        {:ok, %{conversation | match: match}}
    end
  end

  defp active?(%Match{status: "active", expires_at: nil}), do: true

  defp active?(%Match{status: "active", expires_at: %DateTime{} = expires_at}),
    do: DateTime.compare(expires_at, now()) == :gt

  defp active?(_match), do: false

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
