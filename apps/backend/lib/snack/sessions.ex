defmodule Snack.Sessions do
  @moduledoc false

  import Ecto.Query

  alias Ecto.Multi
  alias Snack.Accounts.User
  alias Snack.Repo
  alias Snack.Sessions.Device
  alias Snack.Sessions.RefreshToken
  alias Snack.Sessions.SessionFamily

  def issue_session(%User{} = user, device_attrs) do
    current_time = now()

    Multi.new()
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
    token = get_refresh_token(plain_refresh_token)

    cond do
      is_nil(token) ->
        {:error, :invalid_refresh_token}

      token.status == "rotated" ->
        revoke_family(token.session_family_id)
        {:error, :refresh_token_reused}

      token.status == "revoked" or token.session_family.revoked_at != nil ->
        {:error, :session_revoked}

      DateTime.compare(token.expires_at, now()) == :lt ->
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

  defp rotate_refresh_token(token) do
    current_time = now()

    Multi.new()
    |> Multi.update(
      :rotated_token,
      RefreshToken.changeset(token, %{
        status: "rotated",
        rotated_at: current_time,
        session_family: token.session_family,
        parent_token: token.parent_token
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
    access_token_expires_at = DateTime.add(now(), Snack.Auth.access_token_ttl_seconds(), :second)
    refresh_token_expires_at = DateTime.add(now(), Snack.Auth.refresh_token_ttl_days(), :day)

    %{
      access_token:
        Phoenix.Token.sign(SnackWeb.Endpoint, Snack.Auth.access_token_salt(), %{
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
    expires_at = DateTime.add(current_time, Snack.Auth.refresh_token_ttl_days(), :day)

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
    revoked_at = now()

    from(session_family in SessionFamily, where: session_family.id == ^session_family_id)
    |> Repo.update_all(set: [revoked_at: revoked_at])

    from(refresh_token in RefreshToken,
      where: refresh_token.session_family_id == ^session_family_id
    )
    |> Repo.update_all(set: [status: "revoked", revoked_at: revoked_at])

    :ok
  end

  defp hash_refresh_token(plain_refresh_token) do
    :sha256
    |> :crypto.hash(Snack.Auth.refresh_token_salt() <> plain_refresh_token)
    |> Base.encode16(case: :lower)
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
