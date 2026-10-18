defmodule Cherry.RecoveryJournalTest do
  use Cherry.DataCase, async: false
  alias Cherry.Recovery.Journal
  alias Cherry.Accounts
  alias Cherry.Repo

  setup do
    previous = Application.get_env(:cherry, Journal)

    Application.put_env(:cherry, Journal,
      enabled: true,
      endpoint: "https://journal.test",
      bucket: "ledger",
      access_key_id: "access",
      secret_access_key: "secret",
      request_options: [plug: {Req.Test, Journal}]
    )

    on_exit(fn -> Application.put_env(:cherry, Journal, previous || []) end)

    {:ok, user} =
      Accounts.create_user(%{email: "recovery@example.test", display_name: "Recovery"})

    %{user: user}
  end

  test "journal outage prevents a successful account deletion", %{user: user} do
    Req.Test.stub(Journal, fn conn -> Plug.Conn.send_resp(conn, 503, "") end)
    assert {:error, :erasure_journal_unavailable} = Accounts.delete_account(user)
    assert Repo.get(Cherry.Accounts.User, user.id)
  end

  test "durable request precedes deletion and contains no identity", %{user: user} do
    pid = self()

    Req.Test.stub(Journal, fn conn ->
      assert conn.method == "PUT"
      assert Plug.Conn.get_req_header(conn, "if-none-match") == ["*"]
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      event = Jason.decode!(body)

      assert Map.keys(event) |> Enum.sort() ==
               ~w(finalize_after kind reference requested_at version)

      assert event["reference"] == user.id
      assert Repo.get(Cherry.Accounts.User, user.id)
      send(pid, :recorded)
      Plug.Conn.send_resp(conn, 200, "")
    end)

    assert {:ok, :deleted} = Accounts.delete_account(user)
    assert_received :recorded
    refute Repo.get(Cherry.Accounts.User, user.id)
  end

  test "recovery reapplies acknowledged events, including requests predating the snapshot", %{
    user: user
  } do
    key = "v1/requests/account/#{user.id}.json"

    event =
      Jason.encode!(%{
        version: 1,
        kind: "account",
        reference: user.id,
        requested_at: "2026-01-01T00:00:00Z",
        finalize_after: "2026-01-01T00:00:00Z"
      })

    Req.Test.stub(Journal, fn conn ->
      case {conn.method, conn.request_path} do
        {"GET", "/ledger/"} ->
          Plug.Conn.send_resp(
            conn,
            200,
            "<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>#{key}</Key></Contents></ListBucketResult>"
          )

        {"HEAD", _} ->
          Plug.Conn.send_resp(conn, 200, "")

        {"GET", _} ->
          Plug.Conn.send_resp(conn, 200, event)

        {"PUT", _} ->
          Plug.Conn.send_resp(conn, 412, "")
      end
    end)

    assert {:ok, 1} = Journal.replay()
    assert Repo.get(Cherry.Accounts.User, user.id)
    assert {:ok, 1} = Journal.replay(all: true)
    refute Repo.get(Cherry.Accounts.User, user.id)
    assert {:ok, 1} = Journal.replay(all: true)
  end

  test "refuses an unavailable or truncated registry, rather than treating it as empty" do
    Req.Test.stub(Journal, fn conn ->
      Plug.Conn.send_resp(
        conn,
        200,
        "<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>"
      )
    end)

    assert {:error, :invalid_journal_listing} = Journal.replay(all: true)
    Req.Test.stub(Journal, fn conn -> Plug.Conn.send_resp(conn, 403, "") end)
    assert {:error, :erasure_journal_unavailable} = Journal.replay(all: true)
  end

  test "identity tombstones remove restored associations, keep the account and fail closed for the last method",
       %{user: user} do
    google =
      %Cherry.Identity.ProviderIdentity{}
      |> Cherry.Identity.ProviderIdentity.changeset(%{
        user: user,
        provider: "google",
        provider_subject: "synthetic-google",
        provider_data: %{}
      })
      |> Repo.insert!()

    key = "v1/requests/identity/#{google.id}.json"

    event =
      Jason.encode!(%{
        version: 1,
        kind: "identity",
        reference: google.id,
        requested_at: "2026-01-01T00:00:00Z",
        finalize_after: "2026-01-01T00:00:00Z"
      })

    Req.Test.stub(Journal, fn conn ->
      case {conn.method, conn.request_path} do
        {"GET", "/ledger/"} ->
          Plug.Conn.send_resp(
            conn,
            200,
            "<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>#{key}</Key></Contents></ListBucketResult>"
          )

        {"GET", _} ->
          Plug.Conn.send_resp(conn, 200, event)

        {"HEAD", _} ->
          Plug.Conn.send_resp(conn, 200, "")

        {"PUT", _} ->
          Plug.Conn.send_resp(conn, 412, "")
      end
    end)

    assert {:error, :recovery_replay_pending} = Journal.replay(all: true)
    assert Repo.get(Cherry.Identity.ProviderIdentity, google.id)

    apple =
      %Cherry.Identity.ProviderIdentity{}
      |> Cherry.Identity.ProviderIdentity.changeset(%{
        user: user,
        provider: "apple",
        provider_subject: "synthetic-apple",
        provider_data: %{}
      })
      |> Repo.insert!()

    assert {:ok, 1} = Journal.replay(all: true)
    refute Repo.get(Cherry.Identity.ProviderIdentity, google.id)
    assert Repo.get(Cherry.Identity.ProviderIdentity, apple.id)
    assert Repo.get(Cherry.Accounts.User, user.id)
    assert {:ok, 1} = Journal.replay(all: true)
  end
end
