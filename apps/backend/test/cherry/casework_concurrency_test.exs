defmodule Cherry.CaseworkConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.Backoffice.{Access, Credential, Staff}
  alias Cherry.Casework
  alias Cherry.Casework.{Audit, Case, Notice}
  alias Cherry.Repo
  alias Ecto.Adapters.SQL.Sandbox

  test "real concurrent connections consume a code once and decide a case once" do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    assert [[database]] = Repo.query!("SELECT current_database()").rows
    assert String.contains?(database, "_test")
    owner = user_fixture()

    {:ok, a} =
      Access.provision("reviewer-a-#{System.unique_integer([:positive])}@example.test", "admin")

    {:ok, b} =
      Access.provision("reviewer-b-#{System.unique_integer([:positive])}@example.test", "admin")

    staff_ids = [a.id, b.id]

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)

      # Only rows belonging to this fixture, including audit entries that deliberately don't cascade.
      ids = Repo.all(from(c in Case, where: c.requester_user_id == ^owner.id, select: c.id))

      Repo.delete_all(
        from(e in Audit,
          where: e.staff_id in ^staff_ids or e.user_id == ^owner.id or e.case_id in ^ids
        )
      )

      Repo.delete_all(from(c in Case, where: c.id in ^ids))
      Repo.delete_all(from(s in Staff, where: s.id in ^staff_ids))
      Repo.delete_all(from(u in Cherry.Accounts.User, where: u.id == ^owner.id))
      Sandbox.checkin(Repo)
    end)

    {:ok, code} = Access.issue_login(a.email)
    outcomes = race([fn -> Access.exchange(code) end, fn -> Access.exchange(code) end])
    assert Enum.sort(Enum.map(outcomes, &outcome/1)) == [:invalid_code, :ok]

    assert Repo.aggregate(
             from(c in Credential, where: c.staff_id == ^a.id and c.kind == "session"),
             :count
           ) == 1

    {:ok, record} =
      Casework.submit(owner, %{
        "kind" => "complaint",
        "category" => "service",
        "statement" => "Necesito ayuda con esta incidencia del servicio."
      })

    outcomes =
      race([fn -> Casework.claim(a, record.id) end, fn -> Casework.claim(b, record.id) end])

    assert Enum.sort(Enum.map(outcomes, &outcome/1)) == [:assigned_elsewhere, :ok]
    winner = Repo.get!(Staff, Repo.get!(Case, record.id).assigned_staff_id)

    attrs = %{
      "outcome" => "answered",
      "response" => "Hemos revisado la incidencia y te explicamos el resultado."
    }

    outcomes =
      race([
        fn -> Casework.resolve(winner, record.id, attrs) end,
        fn -> Casework.resolve(winner, record.id, attrs) end
      ])

    assert Enum.sort(Enum.map(outcomes, &outcome/1)) == [:already_resolved, :ok]

    assert Repo.aggregate(
             from(n in Notice, where: n.case_id == ^record.id and n.event == "resolved"),
             :count
           ) == 1

    assert Repo.aggregate(
             from(e in Audit, where: e.case_id == ^record.id and e.action == "case_resolved"),
             :count
           ) == 1

    {:ok, fresh_code} = Access.issue_login(b.email)
    {:ok, %{token: session}} = Access.exchange(fresh_code)

    assert [{:ok, :ok}, {:ok, :ok}] =
             race([fn -> Access.logout(session) end, fn -> Access.disable(b.email) end])

    refute Access.authenticate(session)
  end

  test "an in-flight chat send cannot commit through a concurrent suspension" do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    assert [[database]] = Repo.query!("SELECT current_database()").rows
    assert String.contains?(database, "_test")
    users = [user_fixture(), user_fixture()]
    [a, b] = Enum.map(users, &profile_fixture/1)
    user_ids = Enum.map(users, & &1.id)

    {:ok, staff} =
      Access.provision(
        "chat-reviewer-#{System.unique_integer([:positive])}@example.test",
        "admin"
      )

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)

      ids =
        Repo.all(
          from(c in Case,
            where: c.requester_user_id in ^user_ids or c.subject_user_id in ^user_ids,
            select: c.id
          )
        )

      Repo.delete_all(from(e in Audit, where: e.staff_id == ^staff.id or e.case_id in ^ids))
      Repo.delete_all(from(c in Case, where: c.id in ^ids))
      Repo.delete_all(from(s in Staff, where: s.id == ^staff.id))
      Repo.delete_all(from(u in Cherry.Accounts.User, where: u.id in ^user_ids))
      Sandbox.checkin(Repo)
    end)

    {_match, conversation} = Cherry.TestSupport.SocialFixtures.mutual_match!(a, b)

    {:ok, report} =
      Cherry.Dating.Safety.report(a, b.id, "harassment", "Relato para revisar esta conducta.")

    record = Repo.get_by!(Case, report_id: report.id)
    {:ok, _} = Casework.claim(staff, record.id)
    parent = self()

    {:ok, task} =
      Repo.transaction(fn ->
        {:ok, _} =
          Casework.resolve(staff, record.id, %{
            "outcome" => "suspend",
            "response" => "Se suspende tu cuenta por los motivos acreditados.",
            "reporter_response" => "Hemos revisado y actuado sobre tu reporte."
          })

        task =
          Task.async(fn ->
            :ok = Sandbox.checkout(Repo, sandbox: false)
            send(parent, :send_started)

            try do
              Cherry.Dating.send_message(%{
                conversation_id: conversation.id,
                sender_profile_id: b.id,
                body: "No debe atravesar la suspensión."
              })
            after
              Sandbox.checkin(Repo)
            end
          end)

        assert_receive :send_started
        assert Task.yield(task, 100) == nil
        task
      end)

    assert {:error, :conversation_not_active} = Task.await(task, 5000)

    refute Repo.exists?(
             from(m in Cherry.Dating.Message, where: m.conversation_id == ^conversation.id)
           )
  end

  test "account erasure racing with a chat send leaves neither messages nor queued notifications" do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    assert [[database]] = Repo.query!("SELECT current_database()").rows
    assert String.contains?(database, "_test")
    users = [user_fixture(), user_fixture()]
    [a, b] = Enum.map(users, &profile_fixture/1)
    user_ids = Enum.map(users, & &1.id)
    {match, conversation} = Cherry.TestSupport.SocialFixtures.mutual_match!(a, b)

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)

      Repo.delete_all(
        from(j in Oban.Job,
          where:
            fragment("?->>'recipient_profile_id'", j.args) in ^[a.id, b.id] or
              fragment("?->>'entity_id'", j.args) == ^match.id
        )
      )

      Repo.delete_all(from(u in Cherry.Accounts.User, where: u.id in ^user_ids))
      Sandbox.checkin(Repo)
    end)

    [deletion, sending] =
      race([
        fn -> Cherry.Accounts.delete_account(hd(users)) end,
        fn ->
          Cherry.Dating.send_message(%{
            conversation_id: conversation.id,
            sender_profile_id: b.id,
            body: "Synthetic concurrent message"
          })
        end
      ])

    assert deletion == {:ok, :deleted}
    assert match?({:ok, _}, sending) or sending == {:error, :not_participant}
    refute Repo.get(Cherry.Accounts.User, hd(users).id)
    refute Repo.get(Cherry.Dating.Conversation, conversation.id)

    refute Repo.exists?(
             from(j in Oban.Job,
               where: fragment("?->>'recipient_profile_id'", j.args) in ^[a.id, b.id]
             )
           )
  end

  test "concurrent team changes cannot remove the last activated superuser" do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    assert [[database]] = Repo.query!("SELECT current_database()").rows
    assert String.contains?(database, "_test")

    {:ok, a} =
      Access.provision("root-a-#{System.unique_integer([:positive])}@example.test", "superadmin")

    {:ok, b} =
      Access.provision("root-b-#{System.unique_integer([:positive])}@example.test", "superadmin")

    ids = [a.id, b.id]

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      Repo.delete_all(from(e in Audit, where: e.staff_id in ^ids))
      Repo.delete_all(from(s in Staff, where: s.id in ^ids))
      Sandbox.checkin(Repo)
    end)

    hash = Cherry.Backoffice.Password.hash("synthetic-concurrency-passphrase")
    Repo.update_all(from(s in Staff, where: s.id in ^ids), set: [password_hash: hash])

    results =
      race([
        fn -> Cherry.Backoffice.Team.update(a, a.id, %{"role" => "moderator"}) end,
        fn -> Cherry.Backoffice.Team.update(b, b.id, %{"role" => "moderator"}) end
      ])

    assert Enum.sort(Enum.map(results, &outcome/1)) == [:last_superadmin, :ok]

    assert Repo.aggregate(
             from(s in Staff, where: s.id in ^ids and s.role == "superadmin"),
             :count
           ) == 1
  end

  defp outcome({:ok, _}), do: :ok
  defp outcome({:error, reason}), do: reason

  defp race(functions) do
    parent = self()
    reference = make_ref()

    tasks =
      Enum.map(functions, fn fun ->
        Task.async(fn ->
          :ok = Sandbox.checkout(Repo, sandbox: false)
          send(parent, {:ready, reference, self()})

          receive do
            {:go, ^reference} ->
              try do
                fun.()
              after
                Sandbox.checkin(Repo)
              end
          after
            5000 -> raise "concurrency barrier timed out"
          end
        end)
      end)

    for _ <- tasks do
      receive do
        {:ready, ^reference, _pid} -> :ok
      after
        5000 -> raise "concurrency connection timed out"
      end
    end

    Enum.each(tasks, &send(&1.pid, {:go, reference}))
    Enum.map(tasks, &Task.await(&1, 5000))
  end
end
