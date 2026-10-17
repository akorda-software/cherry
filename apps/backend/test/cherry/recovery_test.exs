defmodule Cherry.RecoveryTest do
  use Cherry.DataCase, async: false
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.Recovery.Journal
  alias Cherry.{Accounts, Dating, Recovery, Sessions}

  setup do
    old_journal = Application.get_env(:cherry, Journal)
    old_r2 = Application.get_env(:cherry, Cherry.Storage.R2)
    old_flag = System.get_env("CHERRY_ISOLATED_RECOVERY")
    System.put_env("CHERRY_ISOLATED_RECOVERY", "true")

    Application.put_env(:cherry, Journal,
      enabled: true,
      endpoint: "https://journal.test",
      bucket: "ledger",
      access_key_id: "access",
      secret_access_key: "secret",
      request_options: [plug: {Req.Test, Journal}]
    )

    Application.put_env(:cherry, Cherry.Storage.R2,
      account_id: "test",
      bucket_name: "photos",
      access_key_id: "access",
      secret_access_key: "secret",
      request_options: [plug: {Req.Test, Cherry.Storage.R2}]
    )

    on_exit(fn ->
      Application.put_env(:cherry, Journal, old_journal || [])
      Application.put_env(:cherry, Cherry.Storage.R2, old_r2 || [])

      if old_flag,
        do: System.put_env("CHERRY_ISOLATED_RECOVERY", old_flag),
        else: System.delete_env("CHERRY_ISOLATED_RECOVERY")
    end)

    registry = start_supervised!({Agent, fn -> %{} end})

    Req.Test.stub(Journal, fn conn ->
      key = String.replace_prefix(conn.request_path, "/ledger/", "")

      cond do
        conn.method == "GET" and key == "" ->
          keys =
            Agent.get(registry, &Map.keys/1)
            |> Enum.filter(&String.starts_with?(&1, "v1/requests/"))

          xml =
            "<ListBucketResult><IsTruncated>false</IsTruncated>" <>
              Enum.map_join(keys, &"<Contents><Key>#{&1}</Key></Contents>") <>
              "</ListBucketResult>"

          Plug.Conn.send_resp(conn, 200, xml)

        conn.method == "PUT" ->
          {:ok, body, conn} = Plug.Conn.read_body(conn)

          status =
            Agent.get_and_update(registry, fn entries ->
              if Map.has_key?(entries, key),
                do: {412, entries},
                else: {200, Map.put(entries, key, body)}
            end)

          Plug.Conn.send_resp(conn, status, "")

        true ->
          case Agent.get(registry, &Map.get(&1, key)) do
            nil -> Plug.Conn.send_resp(conn, 404, "")
            body -> Plug.Conn.send_resp(conn, 200, if(conn.method == "HEAD", do: "", else: body))
          end
      end
    end)

    Req.Test.stub(Cherry.Storage.R2, fn conn ->
      Plug.Conn.send_resp(conn, if(conn.method == "HEAD", do: 200, else: 204), "")
    end)

    user = user_fixture()
    profile = complete_profile_fixture(user)

    for photo <- Dating.list_photos(profile.id) do
      Repo.update!(Ecto.Changeset.change(photo, storage_key: "photos/#{photo.id}.jpg"))
    end

    %{user: user, profile: profile, registry: registry}
  end

  test "an external receipt survives a rolled-back SQL deletion and is replayed", ctx do
    assert {:error, :crash} =
             Repo.transaction(fn ->
               assert {:ok, :deleted} = Accounts.delete_account(ctx.user)
               Repo.rollback(:crash)
             end)

    assert Repo.get(Accounts.User, ctx.user.id)
    assert {:ok, _} = Journal.replay(all: true)
    refute Repo.get(Accounts.User, ctx.user.id)
    refute Repo.exists?(Accounts.ErasureTask)
    assert {:ok, _} = Journal.replay(all: true)
  end

  test "a removed photo stays removed even if its bytes survived and its DB change rolled back",
       ctx do
    [photo | _] = Dating.list_photos(ctx.profile.id)

    assert {:error, :crash} =
             Repo.transaction(fn ->
               assert {:ok, _} = Dating.delete_photo(photo)
               Repo.rollback(:crash)
             end)

    assert Repo.get!(Dating.ProfilePhoto, photo.id).is_active
    assert :ok = Recovery.prepare!()
    refute Repo.get!(Dating.ProfilePhoto, photo.id).is_active
    assert length(Dating.list_photos(ctx.profile.id)) == 1
    refute Repo.get!(Dating.Profile, ctx.profile.id).is_complete
  end

  test "restoration preserves available photos and invalidates all restored sessions", ctx do
    {:ok, issued} =
      Sessions.issue_session(ctx.user, %{
        installation_id: "recovery",
        platform: "ios",
        device_name: "Test"
      })

    assert :ok = Recovery.prepare!()
    assert length(Dating.list_photos(ctx.profile.id)) == 2

    assert Enum.all?(
             Dating.list_photos(ctx.profile.id),
             &String.starts_with?(&1.url, "https://test.r2.cloudflarestorage.com/")
           )

    assert {:error, _} = Sessions.refresh_session(issued.session.refresh_token)
    refute Repo.exists?(Sessions.SessionFamily)
  end

  test "only genuinely missing references are removed", ctx do
    [missing | _] = Dating.list_photos(ctx.profile.id)

    Req.Test.stub(Cherry.Storage.R2, fn conn ->
      Plug.Conn.send_resp(
        conn,
        if(String.ends_with?(conn.request_path, missing.storage_key), do: 404, else: 200),
        ""
      )
    end)

    assert :ok = Recovery.prepare!()
    assert length(Dating.list_photos(ctx.profile.id)) == 1
    refute Repo.get!(Dating.ProfilePhoto, missing.id).is_active
  end

  test "R2 outage is not mistaken for absent photos", ctx do
    Req.Test.stub(Cherry.Storage.R2, fn conn -> Plug.Conn.send_resp(conn, 403, "") end)
    assert_raise RuntimeError, ~r/DO NOT REOPEN/, &Recovery.prepare!/0
    assert length(Dating.list_photos(ctx.profile.id)) == 2
  end

  test "unavailable external registry blocks restoration before it can pass", ctx do
    Req.Test.stub(Journal, fn conn -> Plug.Conn.send_resp(conn, 503, "") end)
    assert_raise RuntimeError, ~r/DO NOT REOPEN/, &Recovery.prepare!/0
    assert Repo.get(Accounts.User, ctx.user.id)
    assert length(Dating.list_photos(ctx.profile.id)) == 2
  end

  test "a fresh account with the same email has a different ID and is not erased", ctx do
    email = ctx.user.email
    assert {:ok, :deleted} = Accounts.delete_account(ctx.user)
    fresh = user_fixture(%{email: email})
    assert {:ok, _} = Journal.replay(all: true)
    assert Repo.get(Accounts.User, fresh.id)
    assert fresh.id != ctx.user.id
  end

  test "offline inventory deletes only orphan objects, never the available gallery", ctx do
    previous = System.get_env("CHERRY_RECOVERY_UPLOADS_QUIESCED")
    System.put_env("CHERRY_RECOVERY_UPLOADS_QUIESCED", "true")

    on_exit(fn ->
      if previous,
        do: System.put_env("CHERRY_RECOVERY_UPLOADS_QUIESCED", previous),
        else: System.delete_env("CHERRY_RECOVERY_UPLOADS_QUIESCED")
    end)

    photos = Dating.list_photos(ctx.profile.id)

    keys =
      Enum.map(photos, & &1.storage_key) ++ ["photos/orphan.jpg", "pending/photos/abandoned.jpg"]

    pid = self()

    Req.Test.stub(Cherry.Storage.R2, fn conn ->
      case conn.method do
        "GET" ->
          xml =
            "<ListBucketResult><IsTruncated>false</IsTruncated>" <>
              Enum.map_join(keys, &"<Contents><Key>#{&1}</Key></Contents>") <>
              "</ListBucketResult>"

          Plug.Conn.send_resp(conn, 200, xml)

        "DELETE" ->
          send(pid, {:deleted, conn.request_path})
          Plug.Conn.send_resp(conn, 204, "")

        "HEAD" ->
          Plug.Conn.send_resp(conn, 404, "")
      end
    end)

    assert :ok = Recovery.reconcile_storage!()
    assert_received {:deleted, "/photos/photos/orphan.jpg"}
    assert_received {:deleted, "/photos/pending/photos/abandoned.jpg"}

    for photo <- photos do
      path = "/photos/" <> photo.storage_key
      refute_received {:deleted, ^path}
    end

    assert length(Dating.list_photos(ctx.profile.id)) == 2
  end
end
