# Synthetic HTTP/WebSocket workload, exclusively in a database ending `_load`.
# See infra/load/README.md. This script also works through `bin/snack eval`.
alias Snack.Repo

database = Repo.config()[:database] || ""
unless String.ends_with?(database, "_load"), do: raise("load fixture requires a *_load database")
Logger.configure(level: :warning)

for child <- [
      Oban,
      Snack.Dating.Discovery.TagWeights,
      Snack.Dating.PhotoStorageSweeper,
      Snack.Dating.MatchExpirySweeper
    ] do
  Supervisor.terminate_child(Snack.Supervisor, child)
end

defmodule Snack.Bench.LoadFixture do
  import Ecto.Query
  alias Snack.Repo
  alias Snack.Dating.{Conversation, Profile}

  def integer(name, default, range) do
    value = System.get_env(name, to_string(default)) |> String.to_integer()
    unless value in range, do: raise("#{name} must be in #{inspect(range)}")
    value
  end

  def insert(table, rows) do
    Stream.chunk_every(rows, 1000) |> Enum.each(&Repo.insert_all(table, &1))
  end

  def seed do
    if System.get_env("LOAD_RESET") == "1" do
      Repo.query!("TRUNCATE users, oban_jobs RESTART IDENTITY CASCADE")
    end

    [[users]] = Repo.query!("SELECT count(*) FROM users").rows
    if users > 0, do: raise("database is populated; use LOAD_EXPORT_ONLY=1 or LOAD_RESET=1")

    n = integer("LOAD_USERS", 2000, 10..100_000)
    history = integer("LOAD_HISTORY", 20, 0..10_000)
    swipes = integer("LOAD_SWIPES", 100, 0..5000)
    matches = integer("LOAD_MATCHES_PER_USER", 4, 2..100)

    unless rem(matches, 2) == 0 and matches < n - 1,
      do: raise("LOAD_MATCHES_PER_USER must be even and < LOAD_USERS - 1")

    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    Snack.Dating.TagCatalog.seed!()

    tag_ids =
      Repo.query!("SELECT id FROM tags WHERE is_active ORDER BY sort_order, id").rows
      |> Enum.map(&hd/1)
      |> List.to_tuple()

    actors =
      for i <- 0..(n - 1),
          do: %{i: i, user_id: Ecto.UUID.bingenerate(), profile_id: Ecto.UUID.bingenerate()}

    actor_tuple = List.to_tuple(actors)
    person = fn i -> elem(actor_tuple, rem(i, n)) end
    stamp = %{inserted_at: now, updated_at: now}

    insert(
      "users",
      Stream.map(actors, fn a ->
        Map.merge(stamp, %{
          id: a.user_id,
          email: "load-#{a.i}@example.test",
          display_name: "Load #{a.i}"
        })
      end)
    )

    insert(
      "profiles",
      Stream.map(actors, fn a ->
        Map.merge(stamp, %{
          id: a.profile_id,
          user_id: a.user_id,
          display_name: "Load #{a.i}",
          birth_date: Date.add(Date.utc_today(), -(20 + rem(a.i, 35)) * 365 - 100),
          gender: Enum.at(["man", "woman", "non_binary"], rem(a.i, 3)),
          looking_for: ["go_with_the_flow"],
          bio: "Perfil sintético para pruebas de carga sostenida.",
          is_complete: true,
          is_discoverable: true,
          is_paused: false,
          completed_at: NaiveDateTime.add(now, -rem(a.i, 10) * 86_400),
          last_active_at: now
        })
      end)
    )

    insert(
      "discovery_preferences",
      Stream.map(actors, fn a ->
        Map.merge(stamp, %{
          id: Ecto.UUID.bingenerate(),
          profile_id: a.profile_id,
          age_min: 18,
          age_max: 100,
          distance_km: if(rem(a.i, 10) == 0, do: 999_999, else: 25),
          show_men: true,
          show_women: true,
          show_non_binary: true,
          expand_distance: true,
          compatible_only: false,
          discovery_mode: "feed"
        })
      end)
    )

    insert(
      "profile_locations",
      Stream.map(actors, fn a ->
        Map.merge(stamp, %{
          profile_id: a.profile_id,
          coordinates: %Geo.Point{
            srid: 4326,
            coordinates: {-3.7038 + rem(a.i, 80) * 0.005, 40.4168 + rem(div(a.i, 80), 80) * 0.005}
          },
          accuracy_meters: 500,
          recorded_at: now
        })
      end)
    )

    insert(
      "profile_tags",
      Stream.flat_map(actors, fn a ->
        Enum.uniq(
          [elem(tag_ids, 0), elem(tag_ids, 1)] ++
            Enum.map(2..4, &elem(tag_ids, rem(a.i * 7 + &1, tuple_size(tag_ids))))
        )
        |> Enum.map(&%{profile_id: a.profile_id, tag_id: &1, inserted_at: now})
      end)
    )

    insert(
      "profile_photos",
      Stream.map(actors, fn a ->
        Map.merge(stamp, %{
          id: Ecto.UUID.bingenerate(),
          profile_id: a.profile_id,
          storage_key: "load/#{a.i}.jpg",
          url: "https://example.test/load/#{a.i}.jpg",
          position: 1,
          is_active: true
        })
      end)
    )

    edges =
      for a <- actors, offset <- 1..div(matches, 2) do
        b = person.(a.i + offset)
        {left, right} = if a.profile_id < b.profile_id, do: {a, b}, else: {b, a}

        %{
          id: Ecto.UUID.bingenerate(),
          conversation_id: Ecto.UUID.bingenerate(),
          a: left,
          b: right,
          source_i: a.i,
          offset: offset
        }
      end

    matched_at = NaiveDateTime.add(now, -10 * 86_400)
    first_at = NaiveDateTime.add(now, -86_400)

    insert(
      "matches",
      Stream.map(edges, fn e ->
        Map.merge(stamp, %{
          id: e.id,
          profile_a_id: e.a.profile_id,
          profile_b_id: e.b.profile_id,
          status: "active",
          matched_at: matched_at,
          first_message_at: if(history > 0, do: first_at),
          expires_at: if(history == 0, do: NaiveDateTime.add(now, 20 * 86_400))
        })
      end)
    )

    insert(
      "conversations",
      Stream.map(edges, &Map.merge(stamp, %{id: &1.conversation_id, match_id: &1.id}))
    )

    partners =
      Enum.reduce(edges, %{}, fn e, acc ->
        acc
        |> Map.update(e.a.profile_id, [e.b.profile_id], &[e.b.profile_id | &1])
        |> Map.update(e.b.profile_id, [e.a.profile_id], &[e.a.profile_id | &1])
      end)

    insert(
      "swipe_actions",
      Stream.flat_map(actors, fn a ->
        known = Map.fetch!(partners, a.profile_id)

        extra =
          if swipes == 0,
            do: [],
            else: Enum.map(1..min(swipes, n - 1), &person.(a.i + div(matches, 2) + &1).profile_id)

        Enum.uniq(known ++ extra)
        |> Enum.reject(&(&1 == a.profile_id))
        |> Enum.map(fn target ->
          %{
            id: Ecto.UUID.bingenerate(),
            actor_profile_id: a.profile_id,
            target_profile_id: target,
            action_type:
              if(target in known or rem(:erlang.phash2(target), 3) == 0,
                do: "like",
                else: "dislike"
              ),
            inserted_at: NaiveDateTime.add(now, -3600)
          }
        end)
      end)
    )

    if history > 0 do
      # Raw bulk rows must be encrypted explicitly; never insert plaintext bodies.
      messages =
        Stream.flat_map(edges, fn e ->
          Stream.map(1..history, fn i ->
            {:ok, body} = Snack.Crypto.encrypt("Mensaje sintético #{i}")
            at = NaiveDateTime.add(first_at, i, :second)

            %{
              id: Ecto.UUID.bingenerate(),
              conversation_id: e.conversation_id,
              sender_profile_id: if(rem(i, 2) == 0, do: e.a.profile_id, else: e.b.profile_id),
              body: body,
              inserted_at: at,
              updated_at: at
            }
          end)
        end)

      insert("messages", messages)
    end

    Repo.query!("VACUUM ANALYZE")
    {:ok, _} = Snack.Dating.Discovery.TagWeights.refresh()

    IO.puts(
      "Seeded #{n} profiles, #{length(edges)} conversations, #{length(edges) * history} encrypted messages."
    )
  end

  def export do
    push? = System.get_env("LOAD_PUSH_TOKENS") == "1"

    if push? do
      url = Application.fetch_env!(:snack, :expo_push)[:base_url]

      case Req.get(String.trim_trailing(url, "/") <> "/healthz",
             retry: false,
             receive_timeout: 2000
           ) do
        {:ok, %{status: 200, body: %{"service" => "snack-expo-stub"}}} -> :ok
        _ -> raise("LOAD_PUSH_TOKENS=1 requires EXPO_PUSH_BASE_URL pointing to the load stub")
      end
    end

    profiles =
      Repo.all(
        from(p in Profile,
          join: u in Snack.Accounts.User,
          on: u.id == p.user_id,
          where: like(u.email, "load-%@example.test"),
          order_by: p.display_name,
          preload: [user: u]
        )
      )

    if profiles == [], do: raise("no load fixture profiles found")

    actors =
      profiles
      |> Task.async_stream(
        fn profile ->
          # One independent session per actor. Fresh exports also revoke old manifests.
          :ok = Snack.Sessions.revoke_user_sessions(profile.user_id)
          installation_id = "load-#{profile.id}"

          {:ok, issued} =
            Snack.Sessions.issue_session(profile.user, %{
              installation_id: installation_id,
              platform: "ios",
              device_name: "Load fixture"
            })

          if push? do
            {:ok, _} =
              Snack.Sessions.register_push_token(profile.user, issued.session_family.id, %{
                "installationId" => installation_id,
                "platform" => "ios",
                "expoPushToken" => "ExponentPushToken[load-#{profile.id}]"
              })
          end

          entry =
            Repo.one(
              from(c in Conversation,
                join: m in Snack.Dating.Match,
                on: m.id == c.match_id,
                where: m.profile_a_id == ^profile.id or m.profile_b_id == ^profile.id,
                order_by: m.id,
                limit: 1,
                select: %{id: c.id, a: m.profile_a_id, b: m.profile_b_id}
              )
            )

          %{
            profileId: profile.id,
            conversationId: entry.id,
            otherProfileId: if(entry.a == profile.id, do: entry.b, else: entry.a),
            accessToken: issued.session.access_token,
            accessTokenExpiresAt: issued.session.access_token_expires_at,
            refreshToken: issued.session.refresh_token
          }
        end,
        max_concurrency: min(8, Repo.config()[:pool_size]),
        timeout: 60_000,
        ordered: true
      )
      |> Enum.map(fn {:ok, actor} -> actor end)

    path = System.get_env("LOAD_MANIFEST", "/tmp/snack-load-actors.json") |> Path.expand()
    File.mkdir_p!(Path.dirname(path))
    temp = path <> ".tmp"

    File.open!(temp, [:write, :exclusive], fn file ->
      File.chmod!(temp, 0o600)

      IO.binwrite(
        file,
        Jason.encode!(%{
          version: 1,
          database: Repo.config()[:database],
          generatedAt: DateTime.utc_now(),
          actors: actors
        })
      )
    end)

    File.rename!(temp, path)
    IO.puts("Exported #{length(actors)} independent sessions to #{path} (mode 0600).")
  end
end

unless System.get_env("LOAD_EXPORT_ONLY") == "1", do: Snack.Bench.LoadFixture.seed()
Snack.Bench.LoadFixture.export()
