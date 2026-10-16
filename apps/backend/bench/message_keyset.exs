# Run with MIX_ENV=test and a verified, local TEST_DATABASE_URL. No persistent
# fixture writes: only a temporary clone of messages, inside a rolled-back
# sandbox transaction. No app data or credentials are printed.
alias Cherry.Repo
alias Ecto.Adapters.SQL.Sandbox

unless Mix.env() == :test and Repo.config()[:pool] == Sandbox do
  raise "this benchmark requires MIX_ENV=test and the SQL sandbox"
end

unless Repo.config()[:hostname] in ["localhost", "127.0.0.1", "::1"] do
  raise "this benchmark only runs against a local test database"
end

:ok = Sandbox.checkout(Repo)

try do
  [[database]] = Repo.query!("SELECT current_database()").rows
  unless String.contains?(database, "_test"), do: raise("refusing a non-test database")

  {:error, :benchmark_finished} =
    Repo.transaction(fn ->
      Repo.query!("CREATE TEMP TABLE cherry_message_page_bench (LIKE messages INCLUDING ALL)")

      Repo.query!("""
      INSERT INTO cherry_message_page_bench
        (id, conversation_id, sender_profile_id, body, inserted_at, updated_at)
      SELECT md5(g::text)::uuid, md5('conversation')::uuid, md5('sender')::uuid,
             decode(repeat('ab', 128), 'hex'),
             timestamp '2026-10-01 12:00:00' + g * interval '1 microsecond',
             timestamp '2026-10-01 12:00:00' + g * interval '1 microsecond'
      FROM generate_series(1, 50000) g
      """)

      Repo.query!("ANALYZE cherry_message_page_bench")

      [[conversation_id, at, id]] =
        Repo.query!("""
        SELECT conversation_id, inserted_at, id FROM cherry_message_page_bench
        ORDER BY inserted_at DESC, id DESC OFFSET 45000 LIMIT 1
        """).rows

      params = [conversation_id, at, id]

      queries = [
        before: """
        SELECT * FROM cherry_message_page_bench
        WHERE conversation_id = $1 AND (inserted_at < $2 OR (inserted_at = $2 AND id < $3))
        ORDER BY inserted_at DESC, id DESC LIMIT 51
        """,
        after: """
        SELECT * FROM cherry_message_page_bench
        WHERE conversation_id = $1 AND (inserted_at, id) < ($2, $3)
        ORDER BY inserted_at DESC, id DESC LIMIT 51
        """
      ]

      [old_rows, new_rows] =
        Enum.map(queries, fn {_name, sql} -> Repo.query!(sql, params).rows end)

      true = old_rows == new_rows and length(new_rows) == 51

      samples =
        for _ <- 1..9, {name, sql} <- queries do
          [[[%{} = plan]]] =
            Repo.query!("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " <> sql, params).rows

          {name, plan}
        end

      IO.puts(
        "50,000 synthetic messages; cursor depth 45,000; 51 identical result rows; 9 samples after warmup"
      )

      for {name, plans} <- Enum.group_by(samples, &elem(&1, 0), &elem(&1, 1)) do
        median = plans |> Enum.map(& &1["Execution Time"]) |> Enum.sort() |> Enum.at(4)
        plan = hd(plans)["Plan"]
        scan = hd(plan["Plans"])

        IO.inspect(
          %{
            median_ms: median,
            scan: scan["Node Type"],
            rows_removed_by_filter: scan["Rows Removed by Filter"] || 0,
            local_buffer_hits: plan["Local Hit Blocks"],
            local_buffer_reads: plan["Local Read Blocks"],
            index_condition: scan["Index Cond"]
          },
          label: to_string(name)
        )
      end

      Repo.rollback(:benchmark_finished)
    end)
after
  Sandbox.checkin(Repo)
end
