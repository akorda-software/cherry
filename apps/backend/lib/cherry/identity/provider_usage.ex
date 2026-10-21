defmodule Cherry.Identity.ProviderUsage do
  @moduledoc """
  Didit sessions started per calendar month (UTC) and the monthly limit
  (`DIDIT_MONTHLY_LIMIT`, config `:cherry, :didit, monthly_limit`; `nil` means
  no limit). Every session costs money, so a slot is reserved atomically
  before asking Didit for a session and given back if Didit does not create
  it. Once the limit is reached, only NFC is left until the next month.

  Only counts are stored: no user, session or document.
  """
  use Ecto.Schema

  import Ecto.Query

  require Logger

  alias Cherry.Repo

  @primary_key {:month, :date, autogenerate: false}
  schema "verification_provider_usage" do
    field(:sessions, :integer, default: 0)
    timestamps(type: :utc_datetime)
  end

  @doc "Monthly limit of sessions, or `nil` without one."
  @spec limit() :: non_neg_integer() | nil
  def limit, do: Application.get_env(:cherry, :didit, [])[:monthly_limit]

  @doc "First day of the month of `now` (UTC)."
  @spec month(DateTime.t()) :: Date.t()
  def month(%DateTime{} = now), do: now |> DateTime.to_date() |> Date.beginning_of_month()

  @doc "Sessions started in the month of `now`."
  @spec used(DateTime.t()) :: non_neg_integer()
  def used(%DateTime{} = now) do
    Repo.one(from(u in __MODULE__, where: u.month == ^month(now), select: u.sessions)) || 0
  end

  @doc "Whether the month of `now` has used up the limit."
  @spec limit_reached?(DateTime.t()) :: boolean()
  def limit_reached?(%DateTime{} = now \\ DateTime.utc_now()) do
    case limit() do
      nil -> false
      limit -> used(now) >= limit
    end
  end

  @doc """
  Takes one session of the month of `now`. Atomic: concurrent requests never
  go over the limit. Returns the month, to give the slot back with
  `release/1` if Didit does not create the session.
  """
  @spec reserve(DateTime.t()) :: {:ok, Date.t()} | {:error, :provider_limit_reached}
  def reserve(%DateTime{} = now) do
    now = DateTime.truncate(now, :second)
    month = month(now)
    limit = limit()

    if limit == 0 do
      {:error, :provider_limit_reached}
    else
      increment =
        from(u in __MODULE__, update: [inc: [sessions: 1], set: [updated_at: ^now]])
        |> under(limit)

      case Repo.insert_all(
             __MODULE__,
             [%{month: month, sessions: 1, inserted_at: now, updated_at: now}],
             on_conflict: increment,
             conflict_target: :month,
             returning: [:sessions]
           ) do
        {1, [%{sessions: sessions}]} ->
          log_usage(sessions, limit)
          {:ok, month}

        {0, _} ->
          {:error, :provider_limit_reached}
      end
    end
  end

  defp under(query, nil), do: query
  defp under(query, limit), do: where(query, [u], u.sessions < ^limit)

  @doc "Gives back a slot taken by `reserve/1` for a session Didit did not create."
  @spec release(Date.t()) :: :ok
  def release(%Date{} = month) do
    from(u in __MODULE__, where: u.month == ^month and u.sessions > 0)
    |> Repo.update_all(inc: [sessions: -1])

    :ok
  end

  defp log_usage(sessions, nil),
    do: Logger.info("age verification (provider): session #{sessions} this month")

  defp log_usage(sessions, limit) when sessions >= limit,
    do: Logger.warning("age verification (provider): monthly limit reached (#{limit})")

  defp log_usage(sessions, limit),
    do: Logger.info("age verification (provider): session #{sessions} of #{limit} this month")
end
