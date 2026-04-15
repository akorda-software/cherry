defmodule Snack.Identity do
  @moduledoc false

  import Ecto.Query

  alias Ecto.Multi
  alias Snack.Accounts
  alias Snack.Identity.ProviderIdentity
  alias Snack.Repo

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
          {:ok, %{user: identity.user, identity: identity, claims: claims}}

        nil ->
          create_identity(provider, claims)
      end
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
        user: user
      })
      |> repo.insert()
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
    if Snack.Auth.supported_provider?(provider) do
      {:ok, Snack.Auth.provider_module(provider)}
    else
      {:error, :unsupported_provider}
    end
  end
end
