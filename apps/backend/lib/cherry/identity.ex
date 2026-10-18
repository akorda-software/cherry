defmodule Cherry.Identity do
  @moduledoc false

  import Ecto.Query

  alias Ecto.Multi
  alias Cherry.Accounts
  alias Cherry.Identity.ProviderIdentity
  alias Cherry.Repo

  def verify_provider(provider, params) do
    with {:ok, module} <- provider(provider), do: module.verify(params)
  end

  def resolve_provider_login(provider, params) when is_atom(provider) do
    with {:ok, provider_module} <- provider(provider),
         {:ok, claims} <- provider_module.verify(params) do
      case Repo.one(
             from(identity in ProviderIdentity,
               where:
                 identity.provider == ^Atom.to_string(provider) and
                   identity.provider_subject == ^claims.subject,
               preload: [:user]
             )
           ) do
        %ProviderIdentity{} = identity ->
          if Accounts.deleted_by_owner?(identity.user) do
            # The person deleted this account and is back: a new account from
            # scratch. The old one is purged first, which also frees its email,
            # identity and document fingerprint for the new one.
            with {:ok, :purged} <- Accounts.purge_account(identity.user) do
              create_identity(provider, claims)
            end
          else
            update_revocation(identity, claims)
          end

        nil ->
          create_identity(provider, claims)
      end
    end
  end

  defp update_revocation(identity, %{revocation_credential: nil} = claims),
    do: {:ok, %{user: identity.user, identity: identity, claims: claims}}

  defp update_revocation(identity, claims) do
    # Serialize credential rotation with account deletion. The erasure path locks
    # this same account before taking a snapshot of its provider identities.
    case Repo.transaction(
           fn ->
             user =
               Repo.one(
                 from(u in Accounts.User,
                   where: u.id == ^identity.user_id,
                   lock: "FOR NO KEY UPDATE"
                 ),
                 log: false
               )

             fresh = Repo.get(ProviderIdentity, identity.id, log: false)
             if is_nil(user) or is_nil(fresh), do: Repo.rollback(:invalid_provider_token)

             updated =
               Repo.update!(
                 Ecto.Changeset.change(fresh,
                   apple_revocation:
                     Cherry.Identity.AppleRevocation.merge(
                       fresh.apple_revocation,
                       claims.revocation_credential
                     )
                 ),
                 log: false
               )

             %{user: user, identity: updated, claims: claims}
           end,
           log: false
         ) do
      {:ok, result} -> {:ok, result}
      error -> error
    end
  end

  defp create_identity(provider, claims) do
    Multi.new()
    |> Multi.run(:user, fn _repo, _changes ->
      Accounts.create_user(%{email: claims.email, display_name: claims.display_name})
    end)
    |> Multi.run(:identity, fn repo, %{user: user} ->
      %ProviderIdentity{}
      |> ProviderIdentity.changeset(%{
        provider: Atom.to_string(provider),
        provider_subject: claims.subject,
        provider_email: claims.email,
        provider_data: claims.provider_data,
        apple_revocation:
          Cherry.Identity.AppleRevocation.merge(%{}, claims.revocation_credential),
        user: user
      })
      |> repo.insert(log: false)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{user: user, identity: identity}} ->
        {:ok, %{user: user, identity: identity, claims: claims}}

      {:error, _step, reason, _changes} ->
        {:error, reason}
    end
  end

  defp provider(provider) do
    if Cherry.Auth.supported_provider?(provider) do
      {:ok, Cherry.Auth.provider_module(provider)}
    else
      {:error, :unsupported_provider}
    end
  end
end
