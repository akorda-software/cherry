defmodule Cherry.AuthMethodsConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  alias Cherry.{Accounts, Identity, Repo, Sessions}
  alias Cherry.Identity.{AuthMethods, ProviderIdentity}
  alias Cherry.TestSupport.{ConcurrentDB, ProviderTokenFactory}
  alias Ecto.Adapters.SQL.Sandbox

  setup do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    assert [[database]] = Repo.query!("SELECT current_database()").rows
    assert String.contains?(database, "_test")
    tokens = ProviderTokenFactory.configure!()
    previous_browser = Application.get_env(:cherry, :apple_browser)
    previous_journal = Application.get_env(:cherry, Cherry.Recovery.Journal)
    Application.put_env(:cherry, :apple_browser, enabled: false)
    Application.put_env(:cherry, Cherry.Recovery.Journal, enabled: false)
    suffix = Ecto.UUID.generate()

    users =
      for index <- 1..2 do
        token =
          ProviderTokenFactory.google_token!(tokens.google_key, %{
            "sub" => "auth-race-#{suffix}-#{index}",
            "email" => "auth-race-#{suffix}-#{index}@example.test"
          })

        {:ok, %{user: user}} = Identity.resolve_provider_login(:google, %{provider_token: token})
        {:ok, issued} = Sessions.issue_session(user, device())
        %{user: user, issued: issued, google: %{"providerToken" => token}}
      end

    ids = Enum.map(users, & &1.user.id)

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      Repo.delete_all(from(u in Accounts.User, where: u.id in ^ids))
      Sandbox.checkin(Repo)
      ProviderTokenFactory.restore!(tokens)
      Application.put_env(:cherry, :apple_browser, previous_browser || [])
      Application.put_env(:cherry, Cherry.Recovery.Journal, previous_journal || [])
    end)

    nonce = Ecto.UUID.generate()

    apple = %{
      "providerToken" =>
        ProviderTokenFactory.apple_token!(tokens.apple_key, nonce, %{
          "sub" => "auth-race-apple-#{suffix}"
        }),
      "nonce" => nonce
    }

    %{first: hd(users), second: List.last(users), apple: apple, ids: ids}
  end

  defp device,
    do: %{
      installation_id: Ecto.UUID.generate(),
      platform: "android",
      device_name: "Synthetic race"
    }

  defp locks(ids),
    do: from(u in Accounts.User, where: u.id in ^ids, order_by: u.id, lock: "FOR UPDATE")

  defp link(ctx, apple),
    do:
      AuthMethods.link(ctx.user.id, ctx.issued.session_family.id, :apple, %{
        "currentProvider" => "google",
        "currentCredential" => ctx.google,
        "credential" => apple
      })

  defp unlink_google(ctx, session_id, apple),
    do:
      AuthMethods.unlink(ctx.user.id, session_id, :google, %{
        "currentProvider" => "apple",
        "currentCredential" => apple
      })

  test "two accounts racing for the same external identity never transfer or duplicate it", ctx do
    results =
      ConcurrentDB.race(locks(ctx.ids), [
        fn -> link(ctx.first, ctx.apple) end,
        fn -> link(ctx.second, ctx.apple) end
      ])

    assert Enum.count(results, &match?({:ok, _}, &1)) == 1
    assert Enum.count(results, &(&1 == {:error, :identity_in_use})) == 1

    assert Repo.aggregate(
             from(i in ProviderIdentity, where: i.user_id in ^ctx.ids and i.provider == "apple"),
             :count
           ) == 1
  end

  test "a link racing with account erasure cannot survive the account cascade", ctx do
    results =
      ConcurrentDB.race(locks([ctx.first.user.id]), [
        fn -> link(ctx.first, ctx.apple) end,
        fn -> Accounts.delete_account(ctx.first.user) end
      ])

    assert List.last(results) == {:ok, :deleted}
    assert match?({:ok, _}, hd(results)) or hd(results) == {:error, :session_revoked}
    refute Repo.get(Accounts.User, ctx.first.user.id)
    refute Repo.exists?(from(i in ProviderIdentity, where: i.user_id == ^ctx.first.user.id))
  end

  test "unlink and an already verified login serialize; no session from the removed identity survives",
       ctx do
    assert {:ok, _} = link(ctx.first, ctx.apple)
    old = Repo.get_by!(ProviderIdentity, user_id: ctx.first.user.id, provider: "google")

    results =
      ConcurrentDB.race(locks([ctx.first.user.id]), [
        fn -> unlink_google(ctx.first, ctx.first.issued.session_family.id, ctx.apple) end,
        fn -> Sessions.issue_session(ctx.first.user, device(), old.id) end
      ])

    assert match?({:ok, _}, hd(results))

    case List.last(results) do
      {:ok, issued} ->
        refute Sessions.active_session_family?(issued.session_family.id, ctx.first.user.id)

      {:error, reason} ->
        assert reason == :identity_unlinked
    end

    assert [%{provider: "apple", canUnlink: false}] = AuthMethods.list(ctx.first.user.id).methods
  end

  test "two authenticated removals serialize and revoke the competing session", ctx do
    assert {:ok, _} = link(ctx.first, ctx.apple)
    {:ok, other} = Sessions.issue_session(ctx.first.user, device())
    current = ctx.first.issued.session_family.id

    results =
      ConcurrentDB.race(locks([ctx.first.user.id]), [
        fn -> unlink_google(ctx.first, current, ctx.apple) end,
        fn -> unlink_google(ctx.first, other.session_family.id, ctx.apple) end
      ])

    assert Enum.count(results, &match?({:ok, _}, &1)) == 1
    assert Enum.count(results, &(&1 == {:error, :session_revoked})) == 1
    assert [%{provider: "apple", canUnlink: false}] = AuthMethods.list(ctx.first.user.id).methods

    assert Enum.count(
             [current, other.session_family.id],
             &Sessions.active_session_family?(&1, ctx.first.user.id)
           ) == 1
  end
end
