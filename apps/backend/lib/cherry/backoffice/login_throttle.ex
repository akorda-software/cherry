defmodule Cherry.Backoffice.LoginThrottle do
  @moduledoc "Shared database rate limit before expensive password hashing; never trusts forwarding headers."
  import Ecto.Query
  alias Cherry.Backoffice.LoginAttempt
  alias Cherry.Repo

  def allow?(ip) do
    key = :crypto.hash(:sha256, :erlang.term_to_binary(ip))
    <<lock::signed-64, _::binary>> = key
    at = DateTime.utc_now() |> DateTime.truncate(:second)

    {:ok, allowed} =
      Repo.transaction(
        fn ->
          Repo.query!("SELECT pg_advisory_xact_lock($1)", [lock])
          Repo.delete_all(from(a in LoginAttempt, where: a.expires_at <= ^at))

          attempt =
            Repo.one(
              from(a in LoginAttempt,
                where: a.key == ^key,
                select: %{attempts: a.attempts}
              )
            )

          case attempt do
            nil ->
              Repo.insert_all(
                LoginAttempt,
                [%{key: key, attempts: 1, expires_at: DateTime.add(at, 900)}],
                log: false
              )

              true

            %{attempts: count} when count < 20 ->
              Repo.update_all(
                from(a in LoginAttempt, where: a.key == ^key),
                [inc: [attempts: 1]],
                log: false
              )

              true

            _ ->
              false
          end
        end,
        log: false
      )

    allowed
  end
end
