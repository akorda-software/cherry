defmodule Cherry.Accounts.Erasure do
  @moduledoc "Physical account deletion and atomic transfer of external cleanup to a minimal outbox."
  import Ecto.Query
  alias Cherry.Accounts.{ErasureTasks, User}

  alias Cherry.Dating.{
    AnalyticsEvent,
    Conversation,
    Match,
    Message,
    Profile,
    ProfilePhoto,
    ProfilePhotoUploadIntent
  }

  alias Cherry.Identity.ProviderSession
  alias Cherry.Repo

  def delete(%User{id: id}) do
    nested? = Repo.in_transaction?()

    with :ok <- Cherry.Recovery.Journal.record("account", id) do
      perform_delete(id, nested?)
    end
  end

  defp perform_delete(id, nested?) do
    result =
      Repo.transaction(
        fn ->
          Cherry.Casework.Lifecycle.erase!()
          profiles = from(p in Profile, where: p.user_id == ^id, select: p.id)

          matches =
            from(m in Match,
              where: m.profile_a_id in subquery(profiles) or m.profile_b_id in subquery(profiles)
            )

          # Match -> account is also the send path's order. Case decisions lock the
          # case before the account. Lock both before the cascading user deletion.
          Repo.all(from(m in matches, order_by: m.id, lock: "FOR UPDATE", select: m.id))

          Cherry.Casework.Erasure.prepare!(id)

          Repo.all(
            from(p in Profile,
              where: p.user_id == ^id,
              order_by: p.id,
              lock: "FOR UPDATE",
              select: p.id
            )
          )

          tasks = storage_tasks(profiles) ++ provider_tasks(id)

          case Cherry.Recovery.Journal.record_tasks(tasks) do
            :ok -> :ok
            {:error, reason} -> Repo.rollback(reason)
          end

          forget_jobs(profiles, matches)

          Repo.delete_all(
            from(e in AnalyticsEvent,
              where: e.user_id == ^id or e.profile_id in subquery(profiles)
            ),
            log: false
          )

          # Original cases, descendants, notices and audit cascade. Other accounts'
          # live measures now have independent, strictly minimal records.
          Repo.delete_all(from(u in User, where: u.id == ^id), log: false)
          tasks
        end,
        log: false
      )

    case result do
      {:ok, tasks} ->
        unless nested? do
          if Process.whereis(Cherry.PubSub),
            do: CherryWeb.Endpoint.broadcast("user_socket:#{id}", "disconnect", %{})

          Enum.each(tasks, &ErasureTasks.process/1)
        end

        {:ok, :purged}

      error ->
        error
    end
  end

  defp storage_tasks(profiles) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    photos =
      Repo.all(
        from(p in ProfilePhoto, where: p.profile_id in subquery(profiles), select: p.storage_key),
        log: false
      )

    intents =
      Repo.all(
        from(i in ProfilePhotoUploadIntent,
          where: i.profile_id in subquery(profiles),
          select: {i.storage_key, i.expires_at}
        ),
        log: false
      )

    Enum.reduce(intents, Map.new(photos, &{&1, now}), fn {key, expiry}, acc ->
      Map.put(acc, key, DateTime.add(expiry, 300))
    end)
    |> Enum.map(fn {key, expiry} -> ErasureTasks.enqueue!("storage", key, expiry).id end)
  end

  defp provider_tasks(id) do
    Repo.all(from(s in ProviderSession, where: s.user_id == ^id, select: s.id), log: false)
    |> Enum.map(&ErasureTasks.enqueue!("provider", &1).id)
  end

  defp forget_jobs(profiles, matches) do
    match_ids = select(matches, [m], type(m.id, :string))

    conversations =
      from(c in Conversation,
        where: c.match_id in subquery(select(matches, [m], m.id)),
        select: c.id
      )

    messages =
      from(m in Message,
        where: m.conversation_id in subquery(conversations),
        select: type(m.id, :string)
      )

    profile_ids =
      from(p in Profile, where: p.id in subquery(profiles), select: type(p.id, :string))

    Repo.delete_all(
      from(j in Oban.Job,
        where:
          fragment("?->>'recipient_profile_id'", j.args) in subquery(profile_ids) or
            fragment("?->>'entity_id'", j.args) in subquery(match_ids) or
            fragment("?->>'entity_id'", j.args) in subquery(messages) or
            fragment("?->>'message_id'", j.args) in subquery(messages)
      ),
      log: false
    )
  end
end
