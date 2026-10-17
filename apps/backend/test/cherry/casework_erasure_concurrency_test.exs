defmodule Cherry.CaseworkErasureConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.{Accounts, Casework, Repo}
  alias Cherry.Backoffice.{Access, Staff}
  alias Cherry.Casework.{Audit, Case}
  alias Ecto.Adapters.SQL.Sandbox

  setup do
    :ok = Sandbox.checkout(Repo, sandbox: false)
    assert [[database]] = Repo.query!("SELECT current_database()").rows
    assert String.contains?(database, "_test")
    reporter = user_fixture()
    subject = user_fixture()
    a = profile_fixture(reporter)
    b = profile_fixture(subject)

    {:ok, decider} =
      Access.provision(
        "race-measure-#{System.unique_integer([:positive])}@example.test",
        "moderator"
      )

    user_ids = [reporter.id, subject.id]

    on_exit(fn ->
      :ok = Sandbox.checkout(Repo, sandbox: false)
      Repo.delete_all(from(u in Accounts.User, where: u.id in ^user_ids))
      Repo.delete_all(from(a in Audit, where: a.staff_id == ^decider.id))
      Repo.delete_all(from(s in Staff, where: s.id == ^decider.id))
      Sandbox.checkin(Repo)
    end)

    {:ok, report} =
      Cherry.Dating.Safety.report(a, b.id, "harassment", "Synthetic concurrent report.")

    record = Repo.get_by!(Case, report_id: report.id)
    {:ok, _} = Casework.claim(decider, record.id)
    %{reporter: reporter, subject: subject, record: record, decider: decider}
  end

  test "a suspension committing before erasure is transferred, never left without review", ctx do
    {:ok, task} =
      Repo.transaction(fn ->
        assert {:ok, _} = Casework.resolve(ctx.decider, ctx.record.id, decision())
        blocked_task(fn -> Accounts.delete_account(ctx.reporter) end)
      end)

    assert {:ok, :deleted} = Task.await(task, 5000)
    subject = Repo.get!(Accounts.User, ctx.subject.id)
    assert subject.suspended_at
    assert Repo.get!(Case, subject.suspension_case_id).kind == "measure"
    refute Repo.get(Case, ctx.record.id)

    assert {:ok, _} =
             Casework.appeal(subject, subject.suspension_case_id, %{
               "statement" => "Solicito una revisión humana de la medida."
             })
  end

  test "an erasure committing before a queued decision prevents a new orphaned suspension", ctx do
    {:ok, task} =
      Repo.transaction(fn ->
        assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
        blocked_task(fn -> Casework.resolve(ctx.decider, ctx.record.id, decision()) end)
      end)

    assert {:error, :not_found} = Task.await(task, 5000)
    refute Repo.get!(Accounts.User, ctx.subject.id).suspended_at
    assert Casework.list_for_user(ctx.subject) == []
  end

  test "an in-flight appeal is retained once when erasure waits for its commit", ctx do
    assert {:ok, _} = Casework.resolve(ctx.decider, ctx.record.id, decision())

    {:ok, task} =
      Repo.transaction(fn ->
        assert {:ok, _} =
                 Casework.appeal(ctx.subject, ctx.record.id, %{
                   "statement" => "Recurso con texto de la denuncia antigua."
                 })

        blocked_task(fn -> Accounts.delete_account(ctx.reporter) end)
      end)

    assert {:ok, :deleted} = Task.await(task, 5000)
    subject = Repo.get!(Accounts.User, ctx.subject.id)
    assert [appeal] = Repo.all(from(c in Case, where: c.kind == "appeal"))
    assert appeal.parent_case_id == subject.suspension_case_id
    assert appeal.status == "open"
    refute appeal.statement =~ "texto de la denuncia antigua"

    assert {:error, :already_appealed} =
             Casework.appeal(subject, subject.suspension_case_id, %{
               "statement" => "No duplicar la revisión ya presentada."
             })
  end

  test "simultaneous deletion of both parties removes original and minimal records", ctx do
    assert {:ok, _} = Casework.resolve(ctx.decider, ctx.record.id, decision())

    tasks =
      Enum.map([ctx.reporter, ctx.subject], fn user ->
        connected_task(fn -> Accounts.delete_account(user) end)
      end)

    assert Enum.map(tasks, &Task.await(&1, 5000)) == [{:ok, :deleted}, {:ok, :deleted}]
    refute Repo.get(Accounts.User, ctx.reporter.id)
    refute Repo.get(Accounts.User, ctx.subject.id)
    refute Repo.exists?(from(c in Case, where: c.subject_user_id == ^ctx.subject.id))
  end

  defp blocked_task(fun) do
    task = connected_task(fun)
    assert Task.yield(task, 100) == nil
    task
  end

  defp connected_task(fun) do
    parent = self()

    task =
      Task.async(fn ->
        :ok = Sandbox.checkout(Repo, sandbox: false)
        send(parent, {:connected, self()})

        try do
          fun.()
        after
          Sandbox.checkin(Repo)
        end
      end)

    pid = task.pid
    assert_receive {:connected, ^pid}
    task
  end

  defp decision,
    do: %{
      "outcome" => "suspend",
      "response" => "Synthetic human decision to suspend this account.",
      "reporter_response" => "Synthetic private notice for this report."
    }
end
