defmodule Cherry.Dating.MatchExpiry do
  @moduledoc """
  Caducidad de matches sin mensajes (D-2026-09-29: 30 días, antes 7).

  La regla se aplica de forma perezosa en todas las lecturas (`expires_at <= now`
  equivale a caducado: no se lista ni permite mensajería). `expire_stale/1`
  además normaliza el `status` a `"expired"` para llamadas manuales; el proceso
  periódico `Cherry.Dating.MatchExpirySweeper` usa `expire_batch/2` para limitar
  las filas y omitir matches bloqueados por otras transacciones.
  """

  import Ecto.Query

  alias Cherry.Dating.Match
  alias Cherry.Repo

  @default_days 30

  @doc "Días de vida de un match sin mensajes (`config :cherry, :match_expiry_days`)."
  def days, do: Application.get_env(:cherry, :match_expiry_days, @default_days)

  @doc "Momento de caducidad para un match creado en `matched_at`."
  def expires_at(%DateTime{} = matched_at) do
    matched_at
    |> DateTime.add(days(), :day)
    |> DateTime.truncate(:second)
  end

  @doc "¿El match sigue vivo en `now`? (activo y sin caducar)."
  def live?(%Match{status: "active", expires_at: nil}, _now), do: true

  def live?(%Match{status: "active", expires_at: %DateTime{} = expires_at}, now),
    do: DateTime.compare(expires_at, now) == :gt

  def live?(_match, _now), do: false

  @doc """
  Marca como `"expired"` los matches activos cuya caducidad ya pasó.
  Devuelve el número de filas actualizadas.
  """
  def expire_stale(now \\ DateTime.utc_now()) do
    now = DateTime.truncate(now, :second)

    {count, _rows} =
      stale_query(now)
      |> Repo.update_all(set: [status: "expired", updated_at: now])

    count
  end

  @doc "Expires at most `limit` matches, skipping rows currently used by another transaction."
  def expire_batch(now \\ DateTime.utc_now(), limit \\ 500)

  def expire_batch(now, limit) when is_integer(limit) and limit in 1..1000 do
    now = DateTime.truncate(now, :second)

    batch =
      stale_query(now)
      |> order_by([m], asc: m.expires_at, asc: m.id)
      |> limit(^limit)
      |> lock("FOR UPDATE SKIP LOCKED")
      |> select([m], %{id: m.id})

    # The batch is picked once, in a materialized CTE. As `id IN (subquery)`
    # the planner may run the locking subquery again for every row (a nested
    # loop semi join); each run skips the rows this statement already updated
    # and takes the next ones, so the update went past `limit`.
    {count, _rows} =
      Match
      |> with_cte("expiry_batch", as: ^batch, materialized: true)
      |> join(:inner, [m], b in "expiry_batch", on: b.id == m.id)
      |> Repo.update_all(set: [status: "expired", updated_at: now])

    count
  end

  def expire_batch(_now, _limit),
    do: raise(ArgumentError, "expiry batch size must be between 1 and 1000")

  defp stale_query(now) do
    from(m in Match,
      where:
        m.status == "active" and is_nil(m.first_message_at) and not is_nil(m.expires_at) and
          m.expires_at <= ^now
    )
  end
end
