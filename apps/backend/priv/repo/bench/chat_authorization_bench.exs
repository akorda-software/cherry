# Concurrent chat authorization benchmark, over committed database connections.
#
#   DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_chat_bench mix ecto.create
#   DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_chat_bench mix ecto.migrate
#   DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_chat_bench \
#     mix run priv/repo/bench/chat_authorization_bench.exs
#
# BENCH_REQUESTS=5000, BENCH_PAIRS=100, BENCH_CONCURRENCY=1,8,32.
# Creates its own fixtures and deletes them afterwards; requires a *_bench DB.
# Measures domain/database authorization, including connection-pool waiting.
# It does not measure HTTP, WebSocket fan-out or push-provider latency.

defmodule Snack.ChatAuthorizationBench do
  import Ecto.Query

  alias Snack.Accounts.User
  alias Snack.Dating.{Conversation, Match, Profile}
  alias Snack.Repo

  def run do
    Logger.configure(level: :warning)
    database = Repo.config()[:database] || ""

    unless String.ends_with?(database, "_bench") do
      Mix.raise("chat_authorization_bench requires a *_bench database, got #{inspect(database)}")
    end

    requests = positive_env("BENCH_REQUESTS", 5000)
    pair_count = positive_env("BENCH_PAIRS", 100)

    concurrency =
      System.get_env("BENCH_CONCURRENCY", "1,8,32")
      |> String.split(",")
      |> Enum.map(fn value ->
        case Integer.parse(value) do
          {n, ""} when n > 0 -> n
          _ -> Mix.raise("invalid BENCH_CONCURRENCY")
        end
      end)

    context =
      Module.safe_concat(String.split(System.get_env("BENCH_CONTEXT", "Snack.Dating"), "."))

    user_ids = Enum.map(1..(pair_count * 2), fn _ -> Ecto.UUID.generate() end)
    handler = {__MODULE__, self()}
    :ok = :telemetry.attach(handler, [:snack, :repo, :query], &__MODULE__.count_query/4, nil)

    try do
      pairs = seed_pairs(user_ids)

      for {conversation_id, profile_id} <- Tuple.to_list(pairs),
          do: authorize(context, conversation_id, profile_id)

      IO.puts(
        "#{inspect(context)}: #{pair_count} pairs, #{requests} requests per run; pool_size=#{Repo.config()[:pool_size]}"
      )

      IO.puts("concurrency | requests/s | p50 ms | p95 ms | p99 ms | queries/request | errors")

      for workers <- concurrency do
        {elapsed, samples} =
          :timer.tc(fn ->
            0..(requests - 1)
            |> Task.async_stream(
              fn index ->
                {conversation_id, profile_id} = elem(pairs, rem(index, tuple_size(pairs)))
                Process.put(:chat_bench_queries, 0)

                {duration, result} =
                  :timer.tc(fn -> authorize(context, conversation_id, profile_id) end)

                {duration / 1000, Process.get(:chat_bench_queries), result}
              end,
              max_concurrency: workers,
              ordered: false,
              timeout: 30_000
            )
            |> Enum.to_list()
          end)

        successful = for {:ok, {ms, queries, {:ok, _}}} <- samples, do: {ms, queries}
        times = successful |> Enum.map(&elem(&1, 0)) |> Enum.sort()
        errors = requests - length(successful)
        queries = Enum.reduce(successful, 0, fn {_, queries}, sum -> sum + queries end)

        IO.puts(
          Enum.join(
            [
              workers,
              format(length(successful) * 1_000_000 / elapsed),
              percentile(times, 0.50),
              percentile(times, 0.95),
              percentile(times, 0.99),
              if(successful == [], do: "-", else: format(queries / length(successful))),
              errors
            ],
            " | "
          )
        )

        if errors > 0, do: Mix.raise("chat authorization benchmark had #{errors} failed requests")
      end
    after
      :telemetry.detach(handler)
      Repo.delete_all(from(u in User, where: u.id in ^user_ids))
    end
  end

  def count_query(_event, _measurements, _metadata, _config) do
    if count = Process.get(:chat_bench_queries), do: Process.put(:chat_bench_queries, count + 1)
  end

  defp authorize(context, conversation_id, profile_id) do
    apply(context, :get_messageable_conversation, [conversation_id, profile_id])
  rescue
    exception -> {:error, exception.__struct__}
  end

  defp seed_pairs(user_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    users =
      Enum.map(
        user_ids,
        &%{
          id: &1,
          email: "chat-bench-#{&1}@example.test",
          display_name: "Bench",
          inserted_at: now,
          updated_at: now
        }
      )

    Repo.insert_all(User, users)

    profiles =
      Enum.map(
        user_ids,
        &%{
          id: Ecto.UUID.generate(),
          user_id: &1,
          display_name: "Bench",
          birth_date: ~D[1995-01-15],
          gender: "man",
          looking_for: ["relationship"],
          bio: "Synthetic chat benchmark profile.",
          inserted_at: now,
          updated_at: now
        }
      )

    Repo.insert_all(Profile, profiles)

    matches =
      profiles
      |> Enum.chunk_every(2)
      |> Enum.map(fn [a, b] ->
        %{
          id: Ecto.UUID.generate(),
          profile_a_id: a.id,
          profile_b_id: b.id,
          status: "active",
          matched_at: now,
          inserted_at: now,
          updated_at: now
        }
      end)

    Repo.insert_all(Match, matches)

    conversations =
      Enum.map(
        matches,
        &%{id: Ecto.UUID.generate(), match_id: &1.id, inserted_at: now, updated_at: now}
      )

    Repo.insert_all(Conversation, conversations)

    Enum.zip(conversations, matches)
    |> Enum.map(fn {conversation, match} -> {conversation.id, match.profile_a_id} end)
    |> List.to_tuple()
  end

  defp positive_env(name, default) do
    case Integer.parse(System.get_env(name, Integer.to_string(default))) do
      {n, ""} when n > 0 -> n
      _ -> Mix.raise("#{name} must be a positive integer")
    end
  end

  defp percentile([], _), do: "-"

  defp percentile(sorted, quantile),
    do: sorted |> Enum.at(max(0, ceil(length(sorted) * quantile) - 1)) |> format()

  defp format(value), do: :erlang.float_to_binary(value / 1, decimals: 2)
end

Snack.ChatAuthorizationBench.run()
