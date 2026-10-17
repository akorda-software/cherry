defmodule Cherry.Legal do
  @moduledoc "Acceptance lifecycle, separate from policy content, HTTP and account erasure."
  import Ecto.Query
  alias Cherry.Accounts.User
  alias Cherry.Legal.{Acceptance, Policy}
  alias Cherry.Repo

  def status(%User{} = user) do
    %{
      required: Policy.enforcement_enabled?(),
      accepted: current?(user),
      version: Cherry.Legal.Documents.version(),
      fingerprint: Policy.fingerprint(),
      ready: Policy.ready?()
    }
  end

  def current?(%User{legal_policy_fingerprint: fingerprint}),
    do: is_binary(fingerprint) and fingerprint == Policy.fingerprint()

  def permitted?(%User{} = user),
    do: not Policy.enforcement_enabled?() or (Policy.ready?() and current?(user))

  def permitted_user?(id) do
    if Policy.enforcement_enabled?() do
      case Repo.get(User, id) do
        %User{} = user -> permitted?(user)
        _ -> false
      end
    else
      true
    end
  end

  # SQL fragments are assembled exclusively from server-generated hex, never input.
  def sql_predicate(alias_name) when alias_name in ["u"] do
    if Policy.enforcement_enabled?() and Policy.ready?(),
      do: "#{alias_name}.legal_policy_fingerprint = '#{Policy.fingerprint()}'",
      else: if(Policy.enforcement_enabled?(), do: "FALSE", else: "TRUE")
  end

  def accept(%User{id: id}, attrs) when is_map(attrs) do
    publication = Policy.publication()

    cond do
      not publication.ready ->
        {:error, :legal_not_ready}

      attrs["version"] != publication.version or attrs["fingerprint"] != publication.fingerprint ->
        {:error, :policy_changed}

      attrs["termsAccepted"] !== true or attrs["sensitiveConsent"] !== true or
          attrs["adulthoodConfirmed"] !== true ->
        {:error, :explicit_declarations_required}

      true ->
        record(id, publication)
    end
  end

  defp record(id, publication) do
    Repo.transaction(fn ->
      # The user row serializes acceptance with deletion; the FK cascades proof.
      # Consent does not depend on the casework context or its lifecycle locks.

      user =
        Repo.one(from(u in User, where: u.id == ^id, lock: "FOR UPDATE")) ||
          Repo.rollback(:not_found)

      now = DateTime.utc_now() |> DateTime.truncate(:second)

      receipt =
        Repo.get_by(Acceptance, user_id: id, fingerprint: publication.fingerprint) ||
          Repo.insert!(
            %Acceptance{
              user_id: id,
              version: publication.version,
              fingerprint: publication.fingerprint,
              snapshot: Map.drop(publication, [:fingerprint, :ready]),
              terms_accepted_at: now,
              sensitive_consented_at: now,
              adulthood_confirmed_at: now
            },
            log: false
          )

      Repo.update!(Ecto.Changeset.change(user, legal_policy_fingerprint: publication.fingerprint),
        log: false
      )

      receipt
    end)
  end
end
