defmodule Cherry.Sessions do
  @moduledoc false

  import Ecto.Query

  alias Ecto.Multi
  alias Cherry.Accounts.User
  alias Cherry.Repo
  alias Cherry.Sessions.Device
  alias Cherry.Sessions.PushToken
  alias Cherry.Sessions.RefreshToken
  alias Cherry.Sessions.SessionFamily

  def issue_session(%User{} = user, device_attrs, identity_id \\ nil) do
    current_time = now()

    Multi.new()
    |> Multi.run(:active_user, fn repo, _changes ->
      case repo.one(from(u in User, where: u.id == ^user.id, lock: "FOR UPDATE")) do
        %User{deleted_at: nil} = active_user ->
          # A provider may have been unlinked after verification but before this
          # account lock. Never mint a session from that removed association.
          if is_nil(identity_id) or
               repo.exists?(
                 from(i in Cherry.Identity.ProviderIdentity,
                   where: i.id == ^identity_id and i.user_id == ^user.id
                 )
               ) do
            {:ok, active_user}
          else
            {:error, :identity_unlinked}
          end

        _ ->
          {:error, :account_deleted}
      end
    end)
    |> Multi.run(:device, fn repo, _changes ->
      upsert_device(repo, user, device_attrs, current_time)
    end)
    |> Multi.run(:session_family, fn repo, %{device: device} ->
      %SessionFamily{}
      |> SessionFamily.changeset(%{user: user, device: device})
      |> repo.insert()
    end)
    |> Multi.run(:refresh_token, fn repo, %{session_family: session_family} ->
      insert_refresh_token(repo, session_family, nil, current_time)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{session_family: session_family, refresh_token: refresh_token}} ->
        {:ok,
         %{
           session: build_session(user, session_family.id, refresh_token.plain_token),
           session_family: session_family
         }}

      {:error, _step, reason, _changes} ->
        {:error, reason}
    end
  end

  def refresh_session(plain_refresh_token) when is_binary(plain_refresh_token) do
    token_hash = hash_refresh_token(plain_refresh_token)

    Repo.transaction(fn ->
      case Repo.one(
             from(t in RefreshToken,
               where: t.token_hash == ^token_hash,
               select: %{id: t.id, session_family_id: t.session_family_id}
             )
           ) do
        nil ->
          {:error, :invalid_refresh_token}

        token ->
          # All rotations and revocations lock the family before touching its
          # tokens. Re-read after waiting: another refresh may have rotated this
          # token, or logout/account deletion may have revoked the family.
          family =
            Repo.one(
              from(s in SessionFamily,
                where: s.id == ^token.session_family_id,
                lock: "FOR UPDATE",
                preload: [:user]
              )
            )

          token = Repo.get(RefreshToken, token.id)

          if family && token,
            do: refresh_locked_token(%{token | session_family: family}),
            else: {:error, :invalid_refresh_token}
      end
    end)
    |> case do
      {:ok, result} -> result
      {:error, reason} -> {:error, reason}
    end
  end

  defp refresh_locked_token(token) do
    cond do
      token.session_family.user.deleted_at != nil ->
        revoke_family(token.session_family_id)
        {:error, :account_deleted}

      token.status == "rotated" ->
        revoke_family(token.session_family_id)
        {:error, :refresh_token_reused}

      token.status == "revoked" or token.session_family.revoked_at != nil ->
        {:error, :session_revoked}

      DateTime.compare(token.expires_at, now()) != :gt ->
        revoke_family(token.session_family_id)
        {:error, :session_revoked}

      true ->
        rotate_refresh_token(token)
    end
  end

  def revoke_session(plain_refresh_token) when is_binary(plain_refresh_token) do
    case get_refresh_token(plain_refresh_token) do
      nil -> :ok
      token -> revoke_family(token.session_family_id)
    end
  end

  def active_session_family?(session_family_id, user_id)
      when is_binary(session_family_id) and is_binary(user_id) do
    Repo.exists?(
      from(session_family in SessionFamily,
        where:
          session_family.id == ^session_family_id and session_family.user_id == ^user_id and
            is_nil(session_family.revoked_at)
      )
    )
  end

  def active_session_family?(_session_family_id, _user_id), do: false

  def revoke_user_sessions(user_id) do
    revoked_at = now()
    families = from(s in SessionFamily, where: s.user_id == ^user_id)
    Repo.update_all(families, set: [revoked_at: revoked_at])

    from(r in RefreshToken, where: r.session_family_id in subquery(select(families, [s], s.id)))
    |> Repo.update_all(set: [status: "revoked", revoked_at: revoked_at])

    from(p in PushToken, where: p.user_id == ^user_id)
    |> Repo.update_all(set: [status: "inactive", disabled_at: revoked_at])

    :ok
  end

  def revoke_other_sessions(user_id, keep_id) do
    revoked_at = now()
    families = from(s in SessionFamily, where: s.user_id == ^user_id and s.id != ^keep_id)
    Repo.update_all(families, set: [revoked_at: revoked_at])

    from(r in RefreshToken, where: r.session_family_id in subquery(select(families, [s], s.id)))
    |> Repo.update_all(set: [status: "revoked", revoked_at: revoked_at])

    from(p in PushToken, where: p.user_id == ^user_id and p.session_family_id != ^keep_id)
    |> Repo.update_all(set: [status: "inactive", disabled_at: revoked_at])

    :ok
  end

  def register_push_token(%User{} = user, session_family_id, attrs) do
    with {:ok, normalized_attrs} <- normalize_push_token_attrs(attrs),
         %SessionFamily{} = session_family <-
           get_active_session_family(session_family_id, user.id),
         :ok <- validate_push_token_device(session_family, normalized_attrs) do
      now = now()

      push_token_attrs = %{
        expo_push_token: normalized_attrs.expo_push_token,
        platform: normalized_attrs.platform,
        installation_id: normalized_attrs.installation_id,
        status: "active",
        last_seen_at: now,
        disabled_at: nil,
        user_id: user.id,
        device_id: session_family.device_id,
        session_family_id: session_family.id
      }

      Multi.new()
      |> Multi.update_all(
        :inactive_duplicate_tokens,
        from(push_token in PushToken,
          where:
            push_token.expo_push_token == ^normalized_attrs.expo_push_token and
              push_token.session_family_id != ^session_family.id and push_token.status == "active"
        ),
        set: [status: "inactive", disabled_at: now]
      )
      |> Multi.run(:push_token, fn repo, _changes ->
        case repo.get_by(PushToken, session_family_id: session_family.id) do
          nil -> %PushToken{}
          push_token -> push_token
        end
        |> PushToken.changeset(push_token_attrs)
        |> repo.insert_or_update()
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{push_token: push_token}} -> {:ok, push_token}
        {:error, :push_token, changeset, _changes} -> {:error, changeset}
      end
    else
      nil -> {:error, :session_revoked}
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_active_session_family(session_family_id, user_id)
       when is_binary(session_family_id) and is_binary(user_id) do
    Repo.one(
      from(session_family in SessionFamily,
        where:
          session_family.id == ^session_family_id and session_family.user_id == ^user_id and
            is_nil(session_family.revoked_at),
        preload: [:device]
      )
    )
  end

  defp get_active_session_family(_session_family_id, _user_id), do: nil

  defp normalize_push_token_attrs(attrs) do
    attrs = %{
      expo_push_token:
        Map.get(attrs, "expoPushToken") || Map.get(attrs, "expo_push_token") ||
          Map.get(attrs, :expo_push_token),
      platform: Map.get(attrs, "platform") || Map.get(attrs, :platform),
      installation_id:
        Map.get(attrs, "installationId") || Map.get(attrs, "installation_id") ||
          Map.get(attrs, :installation_id)
    }

    if is_binary(attrs.expo_push_token) and is_binary(attrs.platform) and
         is_binary(attrs.installation_id) do
      {:ok, attrs}
    else
      {:error, :invalid_push_token_payload}
    end
  end

  defp validate_push_token_device(%SessionFamily{device: %Device{} = device}, attrs) do
    cond do
      device.installation_id != attrs.installation_id -> {:error, :device_mismatch}
      device.platform != attrs.platform -> {:error, :device_mismatch}
      true -> :ok
    end
  end

  defp rotate_refresh_token(token) do
    current_time = now()

    Multi.new()
    |> Multi.update(
      :rotated_token,
      Ecto.Changeset.change(token, %{
        status: "rotated",
        rotated_at: current_time
      })
    )
    |> Multi.run(:replacement_token, fn repo, _changes ->
      insert_refresh_token(repo, token.session_family, token, current_time)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{replacement_token: replacement_token}} ->
        {:ok,
         %{
           session:
             build_session(
               token.session_family.user,
               token.session_family.id,
               replacement_token.plain_token
             )
         }}

      {:error, _step, reason, _changes} ->
        {:error, reason}
    end
  end

  defp build_session(user, session_id, refresh_token) do
    access_token_expires_at = DateTime.add(now(), Cherry.Auth.access_token_ttl_seconds(), :second)
    refresh_token_expires_at = DateTime.add(now(), Cherry.Auth.refresh_token_ttl_days(), :day)

    %{
      access_token:
        Phoenix.Token.sign(CherryWeb.Endpoint, Cherry.Auth.access_token_salt(), %{
          sub: user.id,
          session_id: session_id,
          exp: DateTime.to_unix(access_token_expires_at, :second)
        }),
      access_token_expires_at: DateTime.to_iso8601(access_token_expires_at),
      refresh_token: refresh_token,
      refresh_token_expires_at: DateTime.to_iso8601(refresh_token_expires_at),
      user: %{id: user.id, email: user.email, display_name: user.display_name}
    }
  end

  defp insert_refresh_token(repo, session_family, parent_token, current_time) do
    plain_token = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)
    expires_at = DateTime.add(current_time, Cherry.Auth.refresh_token_ttl_days(), :day)

    attrs = %{
      token_hash: hash_refresh_token(plain_token),
      status: "active",
      expires_at: expires_at,
      session_family: session_family
    }

    attrs = if parent_token, do: Map.put(attrs, :parent_token, parent_token), else: attrs

    case %RefreshToken{} |> RefreshToken.changeset(attrs) |> repo.insert() do
      {:ok, refresh_token} -> {:ok, Map.put(refresh_token, :plain_token, plain_token)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp upsert_device(repo, user, attrs, current_time) do
    installation_id = Map.fetch!(attrs, :installation_id)

    case repo.one(
           from(device in Device,
             where: device.user_id == ^user.id and device.installation_id == ^installation_id,
             preload: [:user]
           )
         ) do
      nil ->
        %Device{}
        |> Device.changeset(Map.merge(attrs, %{last_seen_at: current_time, user: user}))
        |> repo.insert()

      %Device{} = device ->
        device
        |> Device.changeset(Map.merge(attrs, %{last_seen_at: current_time, user: user}))
        |> repo.update()
    end
  end

  defp get_refresh_token(plain_refresh_token) do
    token_hash = hash_refresh_token(plain_refresh_token)

    Repo.one(
      from(refresh_token in RefreshToken,
        where: refresh_token.token_hash == ^token_hash,
        preload: [session_family: [:user, :device], parent_token: []]
      )
    )
  end

  defp revoke_family(session_family_id) do
    Repo.transaction(fn ->
      revoked_at = now()

      # The UPDATE takes the same family lock as refresh_session/1. Keeping both
      # updates in this transaction prevents a replacement from escaping logout.
      from(session_family in SessionFamily, where: session_family.id == ^session_family_id)
      |> Repo.update_all(set: [revoked_at: revoked_at])

      from(refresh_token in RefreshToken,
        where: refresh_token.session_family_id == ^session_family_id
      )
      |> Repo.update_all(set: [status: "revoked", revoked_at: revoked_at])

      :ok
    end)
    |> case do
      {:ok, :ok} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp hash_refresh_token(plain_refresh_token) do
    :sha256
    |> :crypto.hash(Cherry.Auth.refresh_token_salt() <> plain_refresh_token)
    |> Base.encode16(case: :lower)
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
