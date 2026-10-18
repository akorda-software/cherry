defmodule Cherry.Identity.AuthMethods do
  @moduledoc "Explicit proof-of-both ownership; never email-based account merging."
  import Ecto.Query
  alias Cherry.{Identity, Repo, Sessions}
  alias Cherry.Accounts.User
  alias Cherry.Identity.{AppleRevocation, ProviderIdentity}
  alias Cherry.Recovery.Journal
  alias Cherry.Sessions.SessionFamily

  def list(user_id) do
    providers = identities(user_id) |> Enum.map(& &1.provider) |> Enum.uniq() |> Enum.sort()
    %{methods: Enum.map(providers, &%{provider: &1, canUnlink: length(providers) > 1})}
  end

  def link(user_id, session_id, target, params) do
    with {:ok, current, current_claims} <- current_proof(params),
         {:ok, target_claims} <- proof(target, params["credential"]) do
      mutate(user_id, session_id, fn user, rows ->
        current_identity = require_current!(rows, current, current_claims)
        persist_credential!(current_identity, current_claims)

        existing =
          Repo.get_by(
            ProviderIdentity,
            [provider: Atom.to_string(target), provider_subject: target_claims.subject],
            log: false
          )

        cond do
          existing && existing.user_id != user_id ->
            Repo.rollback(:identity_in_use)

          existing ->
            persist_credential!(existing, target_claims)

          Enum.any?(rows, &(&1.provider == Atom.to_string(target))) ->
            Repo.rollback(:provider_already_linked)

          true ->
            changeset =
              ProviderIdentity.changeset(%ProviderIdentity{}, %{
                user: user,
                provider: Atom.to_string(target),
                provider_subject: target_claims.subject,
                provider_email: target_claims.email,
                provider_data: target_claims.provider_data,
                apple_revocation: AppleRevocation.merge(%{}, target_claims.revocation_credential)
              })

            case Repo.insert(changeset, log: false) do
              {:ok, _} -> :ok
              {:error, _} -> Repo.rollback(:identity_in_use)
            end
        end
      end)
    end
  end

  def unlink(user_id, session_id, target, params) do
    with {:ok, current, claims} <- current_proof(params),
         true <- current != target,
         {:ok, result} <-
           mutate(user_id, session_id, fn _user, rows ->
             current_identity = require_current!(rows, current, claims)
             persist_credential!(current_identity, claims)

             case Enum.find(rows, &(&1.provider == Atom.to_string(target))) do
               nil ->
                 :ok

               identity ->
                 ensure_remaining!(rows, identity)

                 case Journal.record("identity", identity.id) do
                   :ok -> :ok
                   _ -> Repo.rollback(:erasure_protection_unavailable)
                 end

                 erase_identity!(identity)
                 Sessions.revoke_other_sessions(user_id, session_id)
             end
           end) do
      disconnect_sockets(user_id)
      {:ok, result}
    else
      false -> {:error, :reauth_with_remaining_method}
      error -> error
    end
  end

  # A durable, already-authorized removal intent; never transfers ownership. On
  # old snapshots with no remaining method, fail recovery closed rather than
  # silently reopening a removed login or stranding the owner without access.
  def erase_for_recovery(id) do
    case Repo.get(ProviderIdentity, id, log: false) do
      nil ->
        :ok

      identity ->
        case Repo.transaction(
               fn ->
                 Repo.one(
                   from(u in User, where: u.id == ^identity.user_id, lock: "FOR NO KEY UPDATE"),
                   log: false
                 )

                 case Repo.get(ProviderIdentity, id, log: false) do
                   nil ->
                     :ok

                   fresh ->
                     ensure_remaining!(identities(fresh.user_id), fresh)
                     erase_identity!(fresh)
                     Sessions.revoke_user_sessions(fresh.user_id)
                 end
               end,
               log: false,
               timeout: 60_000
             ) do
          {:ok, _} ->
            disconnect_sockets(identity.user_id)
            :ok

          _ ->
            {:error, :identity_erasure_pending}
        end
    end
  end

  def parse_provider("google"), do: {:ok, :google}
  def parse_provider("apple"), do: {:ok, :apple}
  def parse_provider(_), do: {:error, :unsupported_provider}

  # Existing sockets do not recheck their session family on every event. Close
  # all transports after commit; the retained session can reconnect normally,
  # while revoked sessions fail the socket's token authentication.
  defp disconnect_sockets(user_id) do
    if not Repo.in_transaction?() and Process.whereis(Cherry.PubSub),
      do: CherryWeb.Endpoint.broadcast("user_socket:#{user_id}", "disconnect", %{})
  end

  defp current_proof(params) when is_map(params) do
    with {:ok, provider} <- parse_provider(params["currentProvider"]),
         {:ok, claims} <- proof(provider, params["currentCredential"]) do
      {:ok, provider, claims}
    else
      _ -> {:error, :reauthentication_required}
    end
  end

  defp current_proof(_), do: {:error, :reauthentication_required}

  defp proof(provider, params) when provider in [:google, :apple] and is_map(params) do
    normalized = %{
      provider_token: params["providerToken"],
      id_token: params["idToken"],
      authorization_code: params["authorizationCode"],
      nonce: params["nonce"]
    }

    with {:ok, claims} <- Identity.verify_provider(provider, normalized),
         true <-
           is_integer(claims.issued_at) and claims.issued_at >= System.os_time(:second) - 300 and
             claims.issued_at <= System.os_time(:second) + 30 do
      {:ok, claims}
    else
      _ -> {:error, :reauthentication_required}
    end
  end

  defp proof(_, _), do: {:error, :reauthentication_required}

  defp mutate(user_id, session_id, fun) do
    case Repo.transaction(
           fn ->
             user =
               Repo.one(from(u in User, where: u.id == ^user_id, lock: "FOR NO KEY UPDATE"),
                 log: false
               )

             if is_nil(user) or not is_nil(user.deleted_at), do: Repo.rollback(:session_revoked)

             family =
               Repo.one(
                 from(s in SessionFamily,
                   where: s.id == ^session_id and s.user_id == ^user_id and is_nil(s.revoked_at),
                   lock: "FOR UPDATE"
                 ),
                 log: false
               )

             if is_nil(family), do: Repo.rollback(:session_revoked)
             fun.(user, identities(user_id))
             list(user_id)
           end,
           log: false,
           timeout: 60_000
         ) do
      {:ok, result} -> {:ok, result}
      error -> error
    end
  end

  defp identities(user_id),
    do:
      Repo.all(from(i in ProviderIdentity, where: i.user_id == ^user_id, order_by: i.id),
        log: false
      )

  defp require_current!(rows, provider, claims) do
    Enum.find(
      rows,
      &(&1.provider == Atom.to_string(provider) and &1.provider_subject == claims.subject)
    ) ||
      Repo.rollback(:reauthentication_required)
  end

  defp persist_credential!(identity, %{revocation_credential: nil}), do: identity

  defp persist_credential!(identity, claims),
    do:
      Repo.update!(
        Ecto.Changeset.change(identity,
          apple_revocation:
            AppleRevocation.merge(identity.apple_revocation, claims.revocation_credential)
        ),
        log: false
      )

  defp ensure_remaining!(rows, identity) do
    unless Enum.any?(rows, &(&1.provider != identity.provider)),
      do: Repo.rollback(:last_auth_method)
  end

  defp erase_identity!(%{provider: "apple"} = identity) do
    if map_size(identity.apple_revocation || %{}) == 0,
      do: Repo.rollback(:apple_reauthentication_required)

    for encrypted <- Map.values(identity.apple_revocation) do
      unless AppleRevocation.revoke(encrypted) == :ok,
        do: Repo.rollback(:apple_revocation_pending)
    end

    Repo.delete!(identity, log: false)
  end

  defp erase_identity!(identity), do: Repo.delete!(identity, log: false)
end
