defmodule Snack.Dating.MatchExpiry do
  @moduledoc """
  Caducidad de matches sin mensajes (D-2026-09-29: 30 días, antes 7).

  La regla se aplica de forma perezosa en todas las lecturas (`expires_at <= now`
  equivale a caducado: no se lista ni permite mensajería). `expire_stale/1`
  además normaliza el `status` a `"expired"`; lo ejecuta periódicamente
  `Snack.Dating.MatchExpirySweeper`.
  """

  import Ecto.Query

  alias Snack.Dating.Match
  alias Snack.Repo

  @default_days 30

  @doc "Días de vida de un match sin mensajes (`config :snack, :match_expiry_days`)."
  def days, do: Application.get_env(:snack, :match_expiry_days, @default_days)

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
      from(m in Match,
        where:
          m.status == "active" and is_nil(m.first_message_at) and not is_nil(m.expires_at) and
            m.expires_at <= ^now
      )
      |> Repo.update_all(set: [status: "expired", updated_at: now])

    count
  end
end
