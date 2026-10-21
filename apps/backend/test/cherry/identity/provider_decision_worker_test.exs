defmodule Cherry.Identity.ProviderDecisionWorkerTest do
  use Cherry.DataCase, async: false
  use Oban.Testing, repo: Cherry.Repo

  import ExUnit.CaptureLog
  import Cherry.TestSupport.DatingFixtures

  alias Cherry.Accounts.User
  alias Cherry.Dating.Profile
  alias Cherry.Identity.{AgeVerifications, ProviderDecisionWorker, ProviderSession}
  alias Cherry.TestSupport.DiditStub

  # A session started from the app (`AgeVerifications.start_provider/3`).
  defp started(user) do
    Repo.insert!(%ProviderSession{id: DiditStub.session_id(), user_id: user.id})
    user
  end

  defp settle(decision) do
    DiditStub.stub(decision: decision)
    perform_job(ProviderDecisionWorker, %{session_id: DiditStub.session_id()})
  end

  # Didit's user record of the session and then the session itself.
  defp assert_erased(user) do
    user_id = user.id
    assert_receive {:didit, "POST", "/v3/users/delete/", %{"vendor_data_list" => [^user_id]}}
    path = "/v3/session/#{DiditStub.session_id()}/delete/"
    assert_receive {:didit, "DELETE", ^path, %{"deletion_instruction" => "privacy_erasure"}}
    refute Repo.get(ProviderSession, DiditStub.session_id())
  end

  test "an approved session the app never checked verifies the user" do
    user = started(user_fixture())

    assert :ok = settle(DiditStub.decision(user.id, "Approved"))

    assert AgeVerifications.verified?(user.id)
    assert_erased(user)
  end

  test "a declined or expired session is erased and the user stays unverified" do
    for status <- ["Declined", "Expired", "Abandoned"] do
      user = started(user_fixture())

      assert :ok = settle(DiditStub.decision(user.id, status))

      refute AgeVerifications.verified?(user.id)
      assert_erased(user)
    end
  end

  test "a minor's document erases the account, as in the app" do
    user = started(user_fixture())
    profile = complete_profile_fixture(user)

    assert :ok =
             settle(DiditStub.decision(user.id, "Approved", %{"date_of_birth" => "2012-06-01"}))

    refute Repo.get(User, user.id)
    refute Repo.get(Profile, profile.id)
    assert_erased(user)
  end

  test "a session the app already settled is left alone" do
    user = user_fixture()

    assert :ok = settle(DiditStub.decision(user.id, "Approved"))

    refute AgeVerifications.verified?(user.id)
    refute_receive {:didit, _, _, _}
  end

  test "a session pending a person's review waits for the next notice" do
    user = started(user_fixture())

    assert :ok = settle(DiditStub.decision(user.id, "In Review"))

    refute_receive {:didit, "DELETE", _, _}
    assert Repo.get(ProviderSession, DiditStub.session_id())
  end

  test "Didit failures are retried" do
    user = started(user_fixture())

    capture_log(fn ->
      assert {:error, :provider_error} = settle({:status, 500})
    end)

    refute AgeVerifications.verified?(user.id)
    assert Repo.get(ProviderSession, DiditStub.session_id())
  end

  test "a decision of another user is not applied" do
    user = started(user_fixture())

    assert :ok = settle(DiditStub.decision(user_fixture().id, "Approved"))

    refute AgeVerifications.verified?(user.id)
    refute_receive {:didit, "DELETE", _, _}
  end
end
