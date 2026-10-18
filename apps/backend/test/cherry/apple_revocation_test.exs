defmodule Cherry.AppleRevocationTest do
  use Cherry.DataCase, async: false
  alias Cherry.{Accounts, Identity, Repo}
  alias Cherry.Identity.{AppleCodeExchange, AppleRevocation, ProviderIdentity, Providers.Apple}
  alias Cherry.Accounts.{ErasureTask, ErasureTasks}
  alias Cherry.Recovery.Journal
  alias Cherry.TestSupport.ProviderTokenFactory, as: Tokens

  @native "cherry-apple-service-id"
  @browser "app.cherry.browser"
  @nonce "synthetic-native-nonce"

  setup do
    before = Application.get_env(:cherry, :apple_browser)
    journal = Application.get_env(:cherry, Journal)
    tokens = Tokens.configure!()

    Application.put_env(:cherry, :apple_browser,
      enabled: true,
      client_id: @browser,
      team_id: "TEAM123456",
      key_id: "KEY1234567",
      private_key: :public_key.generate_key({:namedCurve, :secp256r1}),
      req_options: [plug: {Req.Test, AppleCodeExchange}]
    )

    Application.put_env(:cherry, Journal, enabled: false)

    on_exit(fn ->
      Application.put_env(:cherry, :apple_browser, before || [])
      Application.put_env(:cherry, Journal, journal || [])
      Tokens.restore!(tokens)
    end)

    token = Tokens.apple_token!(tokens.apple_key, @nonce)

    Req.Test.stub(AppleCodeExchange, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      form = URI.decode_query(body)

      case conn.request_path do
        "/auth/token" ->
          assert form["client_id"] == @native
          refute Map.has_key?(form, "redirect_uri")
          assert form["code"] == "synthetic-native-code"

          Req.Test.json(conn, %{
            "id_token" => Process.get(:exchange_token, token),
            "refresh_token" => Process.get(:refresh_token, "synthetic-native-refresh"),
            "access_token" => "synthetic-access-never-retained"
          })

        "/auth/revoke" ->
          assert form["token_type_hint"] == "refresh_token"
          assert form["client_secret"] != ""
          send(self(), {:revoked, form["client_id"], form["token"]})
          Plug.Conn.send_resp(conn, Process.get(:revoke_status, 200), "")
      end
    end)

    %{token: token, tokens: tokens}
  end

  defp login(token) do
    Identity.resolve_provider_login(:apple, %{
      provider_token: token,
      nonce: @nonce,
      authorization_code: "synthetic-native-code"
    })
  end

  test "native code is exchanged server-side and only an encrypted refresh instruction is persisted",
       %{token: token} do
    assert {:ok, %{identity: identity}} = login(token)
    assert [@native] == Map.keys(identity.apple_revocation)
    stored = identity.apple_revocation[@native]
    assert Cherry.Crypto.encrypted?(stored)
    refute stored =~ "synthetic-native-refresh"
    refute inspect(identity) =~ stored
    refute Jason.encode!(identity.provider_data) =~ "refresh"
    refute inspect(identity) =~ "synthetic-access-never-retained"
    assert :ok = AppleRevocation.revoke(stored)
    assert_receive {:revoked, @native, "synthetic-native-refresh"}
  end

  test "native login requires a code when server credentials are enabled", %{token: token} do
    assert {:error, :apple_exchange_failed} =
             Apple.verify(%{provider_token: token, nonce: @nonce})

    assert Repo.aggregate(ProviderIdentity, :count) == 0
  end

  test "exchanged identity must match the signed native subject and nonce", %{
    token: token,
    tokens: tokens
  } do
    for overrides <- [
          %{"sub" => "different-person"},
          %{"nonce" => "different-nonce"},
          %{"aud" => @browser}
        ] do
      Process.put(:exchange_token, Tokens.apple_token!(tokens.apple_key, @nonce, overrides))
      assert {:error, _} = login(token)
    end

    assert Repo.aggregate(ProviderIdentity, :count) == 0
  end

  test "refresh rotation keeps the account and retains a separate browser credential", %{
    token: token
  } do
    assert {:ok, %{user: user, identity: identity}} = login(token)

    browser =
      AppleRevocation.credential(%{
        client_id: @browser,
        refresh_token: "synthetic-browser-refresh"
      })

    Repo.update!(
      Ecto.Changeset.change(identity,
        apple_revocation: AppleRevocation.merge(identity.apple_revocation, browser)
      ),
      log: false
    )

    Process.put(:refresh_token, "synthetic-native-rotated")
    assert {:ok, %{user: %{id: id}, identity: rotated}} = login(token)
    assert id == user.id
    assert rotated.apple_revocation[@browser] == browser
    refute rotated.apple_revocation[@native] == identity.apple_revocation[@native]
    assert Repo.aggregate(ProviderIdentity, :count) == 1
    assert {:ok, :deleted} = Accounts.delete_account(user)
    assert_receive {:revoked, @native, "synthetic-native-rotated"}
    assert_receive {:revoked, @browser, "synthetic-browser-refresh"}
    assert Repo.aggregate(ErasureTask, :count) == 0
  end

  test "Apple outage never keeps the deleted account: encrypted cleanup retries until confirmed",
       %{token: token} do
    assert {:ok, %{user: user}} = login(token)
    Process.put(:revoke_status, 503)
    assert {:ok, :deleted} = Accounts.delete_account(user)
    refute Repo.get(Accounts.User, user.id)
    assert Repo.aggregate(ProviderIdentity, :count) == 0
    assert [task] = Repo.all(ErasureTask)
    assert task.kind == "apple"
    assert Cherry.Crypto.encrypted?(task.reference)
    refute inspect(task) =~ "synthetic-native-refresh"
    refute task.reference =~ user.email
    refute Map.has_key?(Map.from_struct(task), :user_id)
    Process.put(:revoke_status, 200)
    ErasureTasks.sweep(DateTime.add(DateTime.utc_now(), 120))
    assert Repo.aggregate(ErasureTask, :count) == 0
    assert {:ok, _} = Accounts.create_user(%{email: user.email, display_name: "Fresh account"})
  end

  test "caller rollback never revokes a live account's authorization", %{token: token} do
    assert {:ok, %{user: user}} = login(token)

    assert {:error, :cancelled} =
             Repo.transaction(fn ->
               assert {:ok, :deleted} = Accounts.delete_account(user)
               Repo.rollback(:cancelled)
             end)

    assert Repo.get(Accounts.User, user.id)
    refute_received {:revoked, _, _}
    assert Repo.aggregate(ErasureTask, :count) == 0
  end

  test "malformed, plaintext or corrupted instructions fail closed without HTTP calls" do
    for value <- ["plaintext-refresh", "v1:broken", Cherry.Crypto.encrypt!("not-json")] do
      assert {:error, :apple_revocation_pending} = AppleRevocation.revoke(value)
    end

    refute_received {:revoked, _, _}
  end

  defp journal_stub do
    objects = start_supervised!({Agent, fn -> %{} end})

    Application.put_env(:cherry, Journal,
      enabled: true,
      endpoint: "https://journal.test",
      bucket: "ledger",
      access_key_id: "synthetic-access",
      secret_access_key: "synthetic-secret",
      request_options: [plug: {Req.Test, Journal}]
    )

    Req.Test.stub(Journal, fn conn ->
      path = conn.request_path

      case {conn.method, path} do
        {"GET", "/ledger/"} ->
          keys =
            Agent.get(objects, &Map.keys/1)
            |> Enum.filter(&String.starts_with?(&1, "/ledger/v1/requests/"))

          content =
            Enum.map_join(keys, fn key ->
              "<Contents><Key>#{String.replace_prefix(key, "/ledger/", "")}</Key></Contents>"
            end)

          Plug.Conn.send_resp(
            conn,
            200,
            "<ListBucketResult><IsTruncated>false</IsTruncated>#{content}</ListBucketResult>"
          )

        {"GET", _} ->
          case Agent.get(objects, &Map.get(&1, path)) do
            nil -> Plug.Conn.send_resp(conn, 404, "")
            body -> Plug.Conn.send_resp(conn, 200, body)
          end

        {"HEAD", _} ->
          Plug.Conn.send_resp(
            conn,
            if(Agent.get(objects, &Map.has_key?(&1, path)), do: 200, else: 404),
            ""
          )

        {"PUT", _} ->
          {:ok, body, conn} = Plug.Conn.read_body(conn)
          refute body =~ "synthetic-native-refresh"

          status =
            Agent.get_and_update(objects, fn map ->
              if Map.has_key?(map, path), do: {412, map}, else: {200, Map.put(map, path, body)}
            end)

          Plug.Conn.send_resp(conn, status, "")

        {"DELETE", _} ->
          if Process.get(:scrub_failure, false) and String.contains?(path, "/requests/apple/") do
            Plug.Conn.send_resp(conn, 503, "")
          else
            Agent.update(objects, &Map.delete(&1, path))
            Plug.Conn.send_resp(conn, 204, "")
          end
      end
    end)

    objects
  end

  test "external journal recovers pending revocation and destroys encrypted tokens after confirmation",
       %{token: token} do
    objects = journal_stub()
    assert {:ok, %{user: user}} = login(token)
    Process.put(:revoke_status, 503)
    assert {:ok, :deleted} = Accounts.delete_account(user)
    refute Repo.get(Accounts.User, user.id)

    assert Agent.get(objects, fn map ->
             Enum.any?(Map.keys(map), &String.contains?(&1, "/requests/apple/"))
           end)

    # Simulate a restored DB that lost the outbox; the external instruction must suffice.
    Repo.delete_all(ErasureTask)
    Process.put(:revoke_status, 200)
    assert {:ok, _} = Journal.replay(all: true)
    assert Repo.aggregate(ErasureTask, :count) == 0

    refute Agent.get(objects, fn map ->
             Enum.any?(Map.keys(map), &String.contains?(&1, "/apple/"))
           end)

    assert {:ok, _} = Journal.replay(all: true)
  end

  test "a failed journal scrub retains the receipt and can finish without losing the pending task",
       %{token: token} do
    objects = journal_stub()
    assert {:ok, %{user: user}} = login(token)
    Process.put(:scrub_failure, true)
    assert {:ok, :deleted} = Accounts.delete_account(user)
    assert Repo.aggregate(ErasureTask, :count) == 1

    assert Agent.get(objects, fn map ->
             Enum.any?(Map.keys(map), &String.contains?(&1, "/applied/apple/"))
           end)

    Process.put(:scrub_failure, false)
    assert {:ok, _} = Journal.replay()
    ErasureTasks.sweep(DateTime.add(DateTime.utc_now(), 120))
    assert Repo.aggregate(ErasureTask, :count) == 0

    refute Agent.get(objects, fn map ->
             Enum.any?(Map.keys(map), &String.contains?(&1, "/apple/"))
           end)
  end
end
