defmodule Cherry.LegalTest do
  use Cherry.DataCase, async: false
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.Legal.{Acceptance, Policy}
  alias Cherry.{Legal, Repo}

  setup do
    keys = [:public_legal, :instance, :legal_enforcement_enabled]
    previous = Map.new(keys, &{&1, Application.get_env(:cherry, &1)})

    on_exit(fn ->
      for {key, value} <- previous do
        if is_nil(value),
          do: Application.delete_env(:cherry, key),
          else: Application.put_env(:cherry, key, value)
      end
    end)

    Application.put_env(:cherry, :instance,
      operator: "Synthetic operator",
      contact_email: "privacy@example.test",
      country: "ES"
    )

    Application.put_env(:cherry, :public_legal,
      address: "Synthetic address",
      tax_id: "TEST-NIF",
      registry: "No registration applicable: synthetic test",
      approved: true
    )

    Application.put_env(:cherry, :legal_enforcement_enabled, true)
    %{user: user_fixture()}
  end

  test "three exact affirmative declarations are required; a string or terms alone is not consent",
       %{user: user} do
    for key <- ~w(termsAccepted sensitiveConsent adulthoodConfirmed),
        value <- [false, nil, "true", 1] do
      assert {:error, :explicit_declarations_required} =
               Legal.accept(user, Map.put(attributes(), key, value))
    end

    assert Repo.aggregate(Acceptance, :count) == 0
    assert {:ok, receipt} = Legal.accept(user, attributes())
    assert receipt.terms_accepted_at == receipt.sensitive_consented_at
    saved = Repo.reload!(receipt)
    assert saved.snapshot["sensitiveText"] =~ "Consiento explícitamente"
    refute Map.has_key?(saved.snapshot, "ip")
    assert Legal.current?(Repo.reload!(user))
    assert Legal.status(Repo.reload!(user)).accepted
  end

  test "idempotence preserves original proof and its timestamp", %{user: user} do
    assert {:ok, original} = Legal.accept(user, attributes())
    assert {:ok, repeated} = Legal.accept(user, attributes())
    assert repeated.id == original.id
    assert repeated.terms_accepted_at == original.terms_accepted_at
    assert Repo.aggregate(Acceptance, :count) == 1
  end

  test "incomplete identity, unapproved texts and another jurisdiction cannot accept", %{
    user: user
  } do
    config = Application.get_env(:cherry, :public_legal)

    for changed <- [
          Keyword.delete(config, :tax_id),
          Keyword.delete(config, :registry),
          Keyword.put(config, :approved, false)
        ] do
      Application.put_env(:cherry, :public_legal, changed)
      assert {:error, :legal_not_ready} = Legal.accept(user, attributes())
      refute Legal.permitted?(user)
    end

    Application.put_env(:cherry, :public_legal, config)
    Application.put_env(:cherry, :instance, operator: "Other", country: "FR")
    refute Policy.ready?()
  end

  test "changed publication or operator invalidates old proof without overwriting it", %{
    user: user
  } do
    old = attributes()
    {:ok, original} = Legal.accept(user, old)
    config = Application.get_env(:cherry, :instance)

    Application.put_env(
      :cherry,
      :instance,
      Keyword.put(config, :operator, "Different synthetic operator")
    )

    refute Legal.current?(Repo.reload!(user))
    assert {:error, :policy_changed} = Legal.accept(user, old)
    assert {:ok, replacement} = Legal.accept(user, attributes())
    refute replacement.fingerprint == original.fingerprint
    assert Repo.get!(Acceptance, original.id).snapshot["operator"]["name"] == "Synthetic operator"
    assert Repo.aggregate(Acceptance, :count) == 2
  end

  test "account deletion cascades proof; re-registration cannot inherit it", %{user: user} do
    {:ok, receipt} = Legal.accept(user, attributes())
    Repo.delete!(user)
    refute Repo.get(Acceptance, receipt.id)
    replacement = user_fixture(%{email: user.email})
    refute Legal.current?(replacement)
    assert {:error, :not_found} = Legal.accept(user, attributes())
  end

  test "hash is deterministic and includes declaration wording and operator" do
    snapshot = Policy.snapshot()
    assert Policy.fingerprint(snapshot) == Policy.fingerprint(snapshot)

    refute Policy.fingerprint(%{snapshot | sensitiveText: "Different purpose"}) ==
             Policy.fingerprint(snapshot)

    assert String.match?(Policy.fingerprint(), ~r/\A[a-f0-9]{64}\z/)
  end

  defp attributes do
    p = Policy.publication()

    %{
      "version" => p.version,
      "fingerprint" => p.fingerprint,
      "termsAccepted" => true,
      "sensitiveConsent" => true,
      "adulthoodConfirmed" => true
    }
  end
end
