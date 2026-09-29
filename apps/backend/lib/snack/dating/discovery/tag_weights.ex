defmodule Snack.Dating.Discovery.TagWeights do
  @moduledoc """
  Versioned cache of the IDF weights used by discovery tag affinity.

      weight(tag) = ln(1 + N / (1 + n_tag))

  `N` is the number of discoverable profiles (complete, discoverable, not paused,
  profile and account not deleted) and `n_tag` the discoverable profiles that
  carry the tag, so sharing a rare tag ("Vegano/a") is worth more than sharing a
  popular one ("Música"). `N` is floored at 1 so weights are always positive.

  ## Why a cache instead of computing per request

  The weights are global statistics that drift slowly, while computing them costs
  a pass over every `profile_tags` row of every discoverable profile: O(profiles)
  per feed request. A refresh instead writes one new *generation* (one row per
  catalog tag) in a single statement every 15 minutes, and a feed request only
  reads the handful of rows it joins. The feed cursor pins the generation it
  started with, so a refresh never reorders a feed that is being paginated. Generations computed more than two hours ago are
  purged (a cursor lives one hour); the latest generation is always kept.

  Tags missing from the generation (no refresh yet, or a tag created after the
  last refresh) fall back to `default_weight/0` = ln 2, roughly the weight of a
  tag that every profile has: unknown tags never outweigh known rare ones.

  ## Refresher

  This module is also a small GenServer that refreshes once at boot and then
  periodically (`:refresh_interval_ms`, default 15 minutes; retries after one
  minute on failure). A transaction-level advisory lock makes a concurrent
  refresh (several nodes) skip instead of computing the same generation twice. It does not start under the Ecto SQL sandbox
  (tests call `refresh/1` explicitly) or with
  `config :snack, #{inspect(__MODULE__)}, enabled: false`.
  """

  use GenServer

  require Logger

  alias Snack.Repo

  @default_interval_ms :timer.minutes(15)
  @retry_interval_ms :timer.minutes(1)
  @retention_hours 2
  @lock_key :erlang.phash2("snack.discovery.tag_weights")
  @default_weight :math.log(2)

  @doc "Weight used for tags without a cached weight (ln 2)."
  def default_weight, do: @default_weight

  @doc """
  Computes and stores a new generation of weights.

  Returns `{:ok, generation}`, or `{:ok, :skipped}` when another refresh holds the
  lock. `now` is only injectable for tests.
  """
  def refresh(now \\ DateTime.utc_now()) do
    now = now |> DateTime.truncate(:second) |> DateTime.to_naive()
    cutoff = NaiveDateTime.add(now, -@retention_hours * 3600, :second)

    Repo.transaction(fn ->
      if Repo.query!("SELECT pg_try_advisory_xact_lock($1)", [@lock_key]).rows == [[true]] do
        %{rows: [[generation]]} =
          Repo.query!("SELECT nextval('discovery_tag_weights_generation_seq')")

        Repo.query!(insert_generation_sql(), [generation, now])

        Repo.query!(
          "DELETE FROM discovery_tag_weights WHERE generation < $1 AND computed_at < $2",
          [generation, cutoff]
        )

        generation
      else
        :skipped
      end
    end)
  end

  @doc "Latest generation id, or `nil` when the cache has never been refreshed."
  def latest_generation do
    Repo.query!("SELECT max(generation) FROM discovery_tag_weights").rows |> hd() |> hd()
  end

  defp insert_generation_sql do
    """
    WITH discoverable AS (
      SELECT p.id
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.is_discoverable AND p.is_complete AND NOT p.is_paused
        AND p.deleted_at IS NULL AND u.deleted_at IS NULL
    ),
    total AS (SELECT count(*)::int AS n FROM discoverable),
    counts AS (
      SELECT pt.tag_id, count(*)::int AS n
      FROM profile_tags pt
      JOIN discoverable d ON d.id = pt.profile_id
      GROUP BY pt.tag_id
    )
    INSERT INTO discovery_tag_weights
      (generation, tag_id, profile_count, total_profiles, weight, computed_at)
    SELECT $1::bigint, t.id, COALESCE(c.n, 0), total.n,
           ln(1 + GREATEST(total.n, 1)::float8 / (1 + COALESCE(c.n, 0))),
           $2::timestamp
    FROM tags t
    CROSS JOIN total
    LEFT JOIN counts c ON c.tag_id = t.id
    """
  end

  # ── Refresher ─────────────────────────────────────────────────────────

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @impl true
  def init(opts) do
    config = Keyword.merge(Application.get_env(:snack, __MODULE__, []), opts)

    if Keyword.get(config, :enabled, not sandbox_pool?()) do
      {:ok, %{interval: Keyword.get(config, :refresh_interval_ms, @default_interval_ms)},
       {:continue, :refresh}}
    else
      :ignore
    end
  end

  @impl true
  def handle_continue(:refresh, state), do: {:noreply, refresh_and_schedule(state)}

  @impl true
  def handle_info(:refresh, state), do: {:noreply, refresh_and_schedule(state)}

  defp refresh_and_schedule(state) do
    next =
      case safe_refresh() do
        :ok -> state.interval
        :error -> min(state.interval, @retry_interval_ms)
      end

    Process.send_after(self(), :refresh, next)
    state
  end

  defp safe_refresh do
    case refresh() do
      {:ok, _generation_or_skipped} ->
        :ok

      {:error, reason} ->
        Logger.warning("Discovery tag weight refresh failed: #{inspect(reason)}")
        :error
    end
  rescue
    error ->
      Logger.warning("Discovery tag weight refresh failed: #{Exception.message(error)}")
      :error
  catch
    :exit, reason ->
      Logger.warning("Discovery tag weight refresh failed: #{inspect(reason)}")
      :error
  end

  defp sandbox_pool?, do: Repo.config()[:pool] == Ecto.Adapters.SQL.Sandbox
end
