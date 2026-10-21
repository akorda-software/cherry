defmodule Cherry.Accounts.ErasureTasks do
  @moduledoc "Durable, idempotent external cleanup. Instructions disappear after confirmed deletion."
  import Ecto.Query
  alias Cherry.Accounts.ErasureTask
  alias Cherry.Repo

  def enqueue!(kind, reference, finalize_after \\ now()) do
    task = %ErasureTask{
      kind: kind,
      reference: reference,
      not_before: now(),
      finalize_after: finalize_after
    }

    Repo.insert!(task,
      on_conflict:
        from(t in ErasureTask,
          update: [
            set: [
              not_before: ^now(),
              finalize_after: fragment("GREATEST(?, EXCLUDED.finalize_after)", t.finalize_after)
            ]
          ]
        ),
      conflict_target: [:kind, :reference],
      returning: true,
      log: false
    )
  end

  def sweep(at \\ now(), limit \\ 50) when limit in 1..200 do
    ids =
      Repo.all(
        from(t in ErasureTask,
          where: t.not_before <= ^at,
          order_by: [t.not_before, t.id],
          limit: ^limit,
          select: t.id
        ),
        log: false
      )

    Enum.each(ids, &process(&1, at))
    length(ids)
  end

  def process(id, at \\ now()) do
    Repo.transaction(
      fn ->
        case Repo.one(
               from(t in ErasureTask,
                 where: t.id == ^id and t.not_before <= ^at,
                 lock: "FOR UPDATE SKIP LOCKED"
               ),
               log: false
             ) do
          nil -> :ok
          task -> finish(task, erase(task), at)
        end
      end,
      log: false
    )
  rescue
    # The account is already gone. Retain the retry, not a misleading HTTP error.
    _ -> {:error, :cleanup_pending}
  end

  defp erase(%{kind: "storage", reference: key}), do: Cherry.Storage.delete_upload_objects(key)

  defp erase(%{kind: "apple", reference: encrypted}),
    do: Cherry.Identity.AppleRevocation.revoke(encrypted)

  defp erase(%{kind: "provider", reference: id}) do
    if Cherry.Identity.Didit.configured?(),
      do: Cherry.Identity.Didit.erase(id),
      else: {:error, :provider_unavailable}
  end

  defp finish(%{kind: "apple"} = task, :ok, at) do
    # Remove the external encrypted credential as soon as Apple confirms. Never
    # leave it in the long-lived anti-restoration journal after acknowledgement.
    case Cherry.Recovery.Journal.confirm_apple(task.reference) do
      :ok -> Repo.delete!(task, log: false)
      _ -> retry(task, at)
    end
  end

  defp finish(task, :ok, at) do
    if DateTime.compare(at, task.finalize_after) == :lt do
      # A signed PUT may still arrive after the initial deletion. Delete again
      # after its expiry (and the publication grace period), then forget the key.
      Repo.update!(Ecto.Changeset.change(task, not_before: task.finalize_after), log: false)
    else
      Repo.delete!(task, log: false)
    end
  end

  defp finish(task, _, at), do: retry(task, at)

  defp retry(task, at),
    do: Repo.update!(Ecto.Changeset.change(task, not_before: DateTime.add(at, 60)), log: false)

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
