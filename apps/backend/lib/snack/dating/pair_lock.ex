defmodule Snack.Dating.PairLock do
  @moduledoc "Transaction-scoped serialization for swipes and blocks of a profile pair."

  # Serialises swipes between the same two profiles (either direction) until the
  # transaction ends: of two simultaneous likes, the second waits here and — as
  # READ COMMITTED takes a fresh snapshot per statement — its reverse-like check
  # sees the first one committed, so exactly one of them creates the match.
  # Transaction-scoped advisory lock keyed by the ordered pair; a hash collision
  # between two pairs only costs an unnecessary wait.
  def lock(repo, actor_id, target_id)
      when is_binary(actor_id) and is_binary(target_id) do
    [first, second] = Enum.sort([canonical_uuid(actor_id), canonical_uuid(target_id)])

    <<key::signed-integer-size(64), _rest::binary>> =
      :crypto.hash(:sha256, "snack.swipe_pair:" <> first <> ":" <> second)

    case repo.query("SELECT pg_advisory_xact_lock($1)", [key]) do
      {:ok, _result} -> {:ok, key}
      {:error, reason} -> {:error, reason}
    end
  end

  # Invalid ids fail later in the swipe changeset; nothing to serialise.
  def lock(_repo, _actor_id, _target_id), do: {:ok, nil}

  defp canonical_uuid(id) do
    case Ecto.UUID.cast(id) do
      {:ok, uuid} -> uuid
      :error -> id
    end
  end
end
