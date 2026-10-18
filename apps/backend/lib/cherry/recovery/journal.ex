defmodule Cherry.Recovery.Journal do
  @moduledoc "External, private recovery tombstones. Never backed up with PostgreSQL."
  alias Cherry.Repo
  alias Cherry.Accounts.{ErasureTask, ErasureTasks, User}
  alias Cherry.Dating.ProfilePhoto
  import Ecto.Query

  @kinds ~w(account photo storage provider apple)
  @prefix "v1/requests/"

  def enabled?, do: config()[:enabled] == true

  # A successful conditional write is the receipt. An ambiguous timeout is NOT
  # success, but a received request is still replayed even if the DB rolls back.
  def record(kind, reference, finalize_after \\ DateTime.utc_now()) when kind in @kinds do
    if enabled?() do
      event = %{
        "version" => 1,
        "kind" => kind,
        "reference" => reference,
        "requested_at" => DateTime.to_iso8601(DateTime.utc_now()),
        "finalize_after" => finalize_after |> DateTime.truncate(:second) |> DateTime.to_iso8601()
      }

      case request(:put, event_key(kind, reference),
             body: Jason.encode!(event),
             headers: [{"content-type", "application/json"}, {"if-none-match", "*"}]
           ) do
        {:ok, %{status: status}} when status in [200, 201, 204, 412] -> :ok
        _ -> {:error, :erasure_journal_unavailable}
      end
    else
      :ok
    end
  end

  def record_tasks(ids) do
    Repo.all(from(t in ErasureTask, where: t.id in ^ids), log: false)
    |> Enum.reduce_while(:ok, fn task, :ok ->
      case record(task.kind, task.reference, task.finalize_after) do
        :ok -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  def confirm_apple(reference) do
    if enabled?(), do: acknowledge(event_key("apple", reference)), else: :ok
  end

  @doc "Replay pending requests normally, ALL retained requests on isolated recovery."
  def replay(opts \\ []) do
    if enabled?() do
      with {:ok, keys} <- list() do
        {count, failed?} =
          Enum.reduce(Enum.sort(keys), {0, false}, fn key, {count, failed?} ->
            case replay_key(key, Keyword.get(opts, :all, false)) do
              :ok -> {count + 1, failed?}
              _ -> {count, true}
            end
          end)

        cond do
          failed? ->
            {:error, :recovery_replay_pending}

          Keyword.get(opts, :all, false) ->
            with {:ok, current} <- list() do
              cond do
                MapSet.new(current) == MapSet.new(keys) ->
                  {:ok, count}

                Keyword.get(opts, :remaining_passes, 3) > 0 ->
                  replay(
                    Keyword.put(
                      opts,
                      :remaining_passes,
                      Keyword.get(opts, :remaining_passes, 3) - 1
                    )
                  )

                true ->
                  {:error, :recovery_journal_not_stable}
              end
            end

          true ->
            {:ok, count}
        end
      end
    else
      {:error, :erasure_journal_disabled}
    end
  end

  defp replay_key(key, all?) do
    with {:ok, applied?} <- applied?(key) do
      cond do
        applied? and String.starts_with?(key, @prefix <> "apple/") ->
          scrub_apple(key)

        applied? and not all? ->
          :ok

        true ->
          with {:ok, %{status: 200, body: body}} <- request(:get, key),
               {:ok, event} <- Jason.decode(body),
               :ok <- validate_event(key, event),
               :ok <- apply_event(event) do
            # Do not acknowledge a nested transaction before its outer commit.
            if Repo.in_transaction?(), do: :ok, else: acknowledge(key)
          else
            {:ok, %{status: 404}} ->
              # Another account event in this pass may already have completed
              # and scrubbed this Apple instruction after listing it.
              if String.starts_with?(key, @prefix <> "apple/"),
                do: :ok,
                else: {:error, :recovery_replay_failed}

            _ ->
              {:error, :recovery_replay_failed}
          end
      end
    end
  end

  defp apply_event(%{"kind" => "account", "reference" => id}) do
    case Repo.get(User, id, log: false) do
      nil ->
        :ok

      user ->
        case Cherry.Accounts.Erasure.delete(user) do
          {:ok, :purged} -> :ok
          _ -> {:error, :account_erasure_failed}
        end
    end
  end

  defp apply_event(%{"kind" => "photo", "reference" => id}) do
    case Repo.get(ProfilePhoto, id, log: false) do
      nil ->
        :ok

      photo ->
        case Cherry.Dating.Photos.delete_photo(photo) do
          {:ok, _} ->
            if profile = Repo.get(Cherry.Dating.Profile, photo.profile_id),
              do: Cherry.Dating.sync_completed_profile_state(profile)

            :ok

          _ ->
            {:error, :photo_erasure_failed}
        end
    end
  end

  defp apply_event(%{"kind" => kind, "reference" => reference, "finalize_after" => value})
       when kind in ["storage", "provider", "apple"] do
    {:ok, deadline, _} = DateTime.from_iso8601(value)
    task = ErasureTasks.enqueue!(kind, reference, deadline)
    ErasureTasks.process(task.id)

    # Until the upload signature expires or the provider confirms deletion,
    # the external instruction must remain unacknowledged and retryable.
    if Repo.get(ErasureTask, task.id, log: false),
      do: {:error, :external_erasure_pending},
      else: :ok
  end

  defp validate_event(key, %{"version" => 1, "kind" => kind, "reference" => reference} = event)
       when kind in @kinds and is_binary(reference) do
    with true <- key == event_key(kind, reference),
         {:ok, _, _} <- DateTime.from_iso8601(event["requested_at"] || ""),
         {:ok, _, _} <- DateTime.from_iso8601(event["finalize_after"] || ""),
         true <- kind not in ["account", "photo"] or match?({:ok, _}, Ecto.UUID.cast(reference)) do
      :ok
    else
      _ -> {:error, :invalid_recovery_event}
    end
  end

  defp validate_event(_, _), do: {:error, :invalid_recovery_event}

  defp event_key(kind, reference) do
    id =
      if kind in ["account", "photo"],
        do: reference,
        else: :crypto.hash(:sha256, reference) |> Base.encode16(case: :lower)

    @prefix <> kind <> "/" <> id <> ".json"
  end

  defp applied?(key) do
    case request(:head, applied_key(key)) do
      {:ok, %{status: 200}} -> {:ok, true}
      {:ok, %{status: 404}} -> {:ok, false}
      _ -> {:error, :erasure_journal_unavailable}
    end
  end

  defp acknowledge(key) do
    case request(:put, applied_key(key),
           body: Jason.encode!(%{completed_at: DateTime.to_iso8601(DateTime.utc_now())}),
           headers: [{"content-type", "application/json"}, {"if-none-match", "*"}]
         ) do
      {:ok, %{status: status}} when status in [200, 201, 204, 412] ->
        if String.starts_with?(key, @prefix <> "apple/"), do: scrub_apple(key), else: :ok

      _ ->
        {:error, :erasure_journal_unavailable}
    end
  end

  defp scrub_apple(key) do
    # Keep the acknowledgement until deleting the sensitive request succeeds.
    # On a crash/retry, replay sees the acknowledgement and only scrubs, without
    # resurrecting an already completed revocation task.
    with {:ok, %{status: status}} when status in [200, 204, 404] <- request(:delete, key),
         {:ok, %{status: 404}} <- request(:head, key) do
      # The marker contains only a completion date; a failed marker cleanup is
      # harmless and the backup GC already removes orphan acknowledgements.
      request(:delete, applied_key(key))
      :ok
    else
      _ -> {:error, :erasure_journal_unavailable}
    end
  end

  defp applied_key(key), do: String.replace_prefix(key, @prefix, "v1/applied/")

  # R2's ListObjectsV2 XML has only application-controlled ASCII keys here.
  # Parse this deliberately narrow grammar, reject unexpected keys/DTD and
  # follow every continuation token. No XML external entity processing.
  defp list(token \\ nil, acc \\ []) do
    params = [{"list-type", "2"}, {"prefix", @prefix}, {"max-keys", "1000"}]
    params = if token, do: params ++ [{"continuation-token", token}], else: params

    with {:ok, %{status: 200, body: xml}} <- request(:get, "", params: params),
         true <- String.contains?(xml, "<ListBucketResult") and not String.contains?(xml, "<!"),
         keys <-
           Regex.scan(~r/<Key>([^<]+)<\/Key>/, xml, capture: :all_but_first) |> List.flatten(),
         true <-
           Enum.all?(
             keys,
             &Regex.match?(
               ~r/^v1\/requests\/(account|photo|storage|provider|apple)\/[a-f0-9-]+\.json$/,
               &1
             )
           ) do
      cond do
        String.contains?(xml, "<IsTruncated>false</IsTruncated>") ->
          {:ok, acc ++ keys}

        String.contains?(xml, "<IsTruncated>true</IsTruncated>") ->
          case Regex.run(~r/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/, xml) do
            [_, next] when next != token -> list(unescape(next), acc ++ keys)
            _ -> {:error, :invalid_journal_listing}
          end

        true ->
          {:error, :invalid_journal_listing}
      end
    else
      _ -> {:error, :erasure_journal_unavailable}
    end
  end

  defp unescape(value) do
    Enum.reduce(
      [{"&quot;", "\""}, {"&apos;", "'"}, {"&lt;", "<"}, {"&gt;", ">"}, {"&amp;", "&"}],
      value,
      fn {from, to}, acc -> String.replace(acc, from, to) end
    )
  end

  defp request(method, key, opts \\ []) do
    c = config()

    if Enum.all?(
         [:endpoint, :bucket, :access_key_id, :secret_access_key],
         &(is_binary(c[&1]) and c[&1] != "")
       ) do
      path =
        Enum.map_join(
          String.split(key, "/", trim: true),
          "/",
          &URI.encode(&1, fn char -> URI.char_unreserved?(char) end)
        )

      Req.request(
        [
          method: method,
          url: String.trim_trailing(c[:endpoint], "/") <> "/" <> c[:bucket] <> "/" <> path,
          aws_sigv4: [
            access_key_id: c[:access_key_id],
            secret_access_key: c[:secret_access_key],
            region: "auto",
            service: "s3"
          ],
          retry: false,
          redirect: false,
          decode_body: false,
          receive_timeout: 10_000
        ]
        |> Keyword.merge(opts)
        |> Keyword.merge(c[:request_options] || [])
      )
    else
      {:error, :erasure_journal_unavailable}
    end
  end

  defp config, do: Application.get_env(:cherry, __MODULE__, [])
end
