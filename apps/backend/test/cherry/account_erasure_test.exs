defmodule Cherry.TestSupport.ErasureStorage do
  def delete_object(key) do
    send(self(), {:erased_object, key})
    Process.get(:erasure_storage_result, :ok)
  end
end

defmodule Cherry.AccountErasureTest do
  use Cherry.DataCase, async: false
  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures
  alias Cherry.{Accounts, Casework, Dating, Repo, Sessions}
  alias Cherry.Accounts.{ErasureTask, ErasureTasks}
  alias Cherry.Casework.{Audit, Case, Notice}

  alias Cherry.Identity.{
    AgeVerification,
    AgeVerificationAttempt,
    ProviderIdentity,
    ProviderSession
  }

  alias Cherry.TestSupport.DiditStub

  setup do
    previous = Application.get_env(:cherry, Cherry.Storage)
    Application.put_env(:cherry, Cherry.Storage, adapter: Cherry.TestSupport.ErasureStorage)
    on_exit(fn -> Application.put_env(:cherry, Cherry.Storage, previous) end)
    :ok
  end

  test "erasure removes the account graph, narratives, notices, audit and queued events, not other accounts" do
    user = user_fixture()
    other = user_fixture()
    a = complete_profile_fixture(user)
    b = complete_profile_fixture(other)
    {match, conversation} = mutual_match!(a, b)

    {:ok, message} =
      Dating.send_message(%{
        conversation_id: conversation.id,
        sender_profile_id: a.id,
        body: "Private text"
      })

    Repo.insert!(%ProviderIdentity{
      user_id: user.id,
      provider: "google",
      provider_subject: "subject-erased",
      provider_email: user.email
    })

    fingerprint = :crypto.strong_rand_bytes(32)

    Repo.insert!(%AgeVerification{
      user_id: user.id,
      method: "nfc_dni",
      status: "verified",
      verified_at: now(),
      document_fingerprint: fingerprint
    })

    Repo.insert!(%AgeVerificationAttempt{user_id: user.id, inserted_at: now()})

    Repo.insert!(%Dating.AnalyticsEvent{
      user_id: user.id,
      profile_id: a.id,
      event_name: "test",
      payload: %{text: "personal"}
    })

    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: "erased-device",
        platform: "ios",
        device_name: "Erased"
      })

    {:ok, _} =
      Sessions.register_push_token(user, issued.session_family.id, %{
        installation_id: "erased-device",
        platform: "ios",
        expo_push_token: "ExponentPushToken[synthetic-erasure]"
      })

    {:ok, report} = Dating.Safety.report(a, b.id, "harassment", "Personal narrative")
    record = Repo.get_by!(Case, report_id: report.id)

    {:ok, request} =
      Casework.submit(user, %{
        "kind" => "privacy",
        "category" => "erasure",
        "statement" => "Elimina todos mis datos personales."
      })

    child =
      Repo.insert!(%Case{
        kind: "complaint",
        category: "service",
        statement: "Descendant narrative",
        parent_case_id: request.id,
        requester_user_id: other.id
      })

    Audit.record!("case_viewed", %{case_id: child.id})

    assert {:ok, :deleted} = Accounts.delete_account(user)
    refute Repo.get(Accounts.User, user.id)
    assert Repo.get(Accounts.User, other.id)
    assert Repo.get(Dating.Profile, b.id)

    for {schema, id} <- [
          {Dating.Profile, a.id},
          {Dating.Match, match.id},
          {Dating.Conversation, conversation.id},
          {Dating.Message, message.id},
          {Case, record.id},
          {Case, request.id},
          {Case, child.id}
        ] do
      refute Repo.get(schema, id)
    end

    for schema <- [
          ProviderIdentity,
          AgeVerification,
          AgeVerificationAttempt,
          Dating.AnalyticsEvent,
          Notice
        ] do
      assert Repo.aggregate(schema, :count) == 0
    end

    refute Repo.exists?(
             from(e in Audit,
               where: e.user_id == ^user.id or e.case_id in ^[record.id, request.id, child.id]
             )
           )

    assert Repo.aggregate(Oban.Job, :count) == 0
    assert {:error, _} = Sessions.refresh_session(issued.session.refresh_token)
    assert {:ok, fresh} = Accounts.create_user(%{email: user.email, display_name: "Fresh"})

    assert {:ok, _} =
             Repo.insert(%AgeVerification{
               user_id: fresh.id,
               method: "nfc_dni",
               status: "verified",
               verified_at: now(),
               document_fingerprint: fingerprint
             })

    assert {:ok, :deleted} = Accounts.delete_account(user)
    assert Repo.get(Accounts.User, fresh.id)
  end

  test "a suspended account leaves no blacklist or document fingerprint" do
    user = user_fixture()
    Repo.update!(Ecto.Changeset.change(user, suspended_at: now()))

    Repo.insert!(%AgeVerification{
      user_id: user.id,
      method: "nfc_dni",
      status: "verified",
      verified_at: now(),
      document_fingerprint: :crypto.strong_rand_bytes(32)
    })

    assert {:ok, :deleted} = Accounts.delete_account(user)
    refute Repo.get(Accounts.User, user.id)
    assert Repo.aggregate(AgeVerification, :count) == 0
    assert {:ok, _} = Accounts.create_user(%{email: user.email, display_name: "New"})
  end

  test "failed file deletion retains only a temporary instruction, retries and then disappears" do
    user = user_fixture()
    profile = profile_fixture(user)
    key = "photos/synthetic-erasure.jpg"

    {:ok, _} =
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: key,
        url: "https://example.test/photo",
        position: 1
      })

    Process.put(:erasure_storage_result, {:error, :unavailable})
    assert {:ok, :deleted} = Accounts.delete_account(user)
    refute Repo.get(Accounts.User, user.id)
    assert [task] = Repo.all(ErasureTask)
    assert task.reference == key
    refute Map.has_key?(Map.from_struct(task), :user_id)
    assert_receive {:erased_object, "pending/" <> ^key}
    Process.put(:erasure_storage_result, :ok)
    assert ErasureTasks.sweep(DateTime.add(now(), 120)) == 1
    assert_receive {:erased_object, ^key}
    assert Repo.aggregate(ErasureTask, :count) == 0
  end

  test "signed uploads are deleted again after expiry so a late PUT cannot be forgotten" do
    user = user_fixture()
    profile = profile_fixture(user)
    key = "photos/synthetic-pending.jpg"
    expires = DateTime.add(now(), 600)

    Repo.insert!(%Dating.ProfilePhotoUploadIntent{
      profile_id: profile.id,
      storage_key: key,
      public_url: "https://example.test/pending",
      content_type: "image/jpeg",
      size_bytes: 10,
      position: 1,
      expires_at: expires
    })

    assert {:ok, :deleted} = Accounts.delete_account(user)
    assert_receive {:erased_object, ^key}
    assert [task] = Repo.all(ErasureTask)
    assert task.finalize_after == DateTime.add(expires, 300)
    # Re-enqueuing cannot shorten the safety window and must return the real id.
    again = ErasureTasks.enqueue!("storage", key)
    assert again.id == task.id
    assert again.finalize_after == task.finalize_after
    ErasureTasks.process(task.id)
    assert Repo.get(ErasureTask, task.id)
    assert ErasureTasks.sweep(DateTime.add(expires, 301)) == 1
    refute Repo.get(ErasureTask, task.id)
  end

  test "a caller rollback does not delete files or broadcast a committed deletion" do
    user = user_fixture()
    profile = profile_fixture(user)

    {:ok, _} =
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: "photos/rollback.jpg",
        url: "https://example.test/photo",
        position: 1
      })

    Phoenix.PubSub.subscribe(Cherry.PubSub, "user_socket:#{user.id}")

    assert {:error, :cancelled} =
             Repo.transaction(fn ->
               assert {:ok, :deleted} = Accounts.delete_account(user)
               Repo.rollback(:cancelled)
             end)

    assert Repo.get(Accounts.User, user.id)
    assert Repo.aggregate(ErasureTask, :count) == 0
    refute_receive {:erased_object, _}
    refute_receive %Phoenix.Socket.Broadcast{event: "disconnect"}
  end

  test "unfinished provider sessions are tracked and erased even when the user never checks again" do
    user = user_fixture()
    DiditStub.stub(delete_status: 503)
    assert {:ok, %{session_id: id}} = Cherry.Identity.AgeVerifications.start_provider(user, nil)
    assert Repo.get(ProviderSession, id).user_id == user.id
    assert {:ok, :deleted} = Accounts.delete_account(user)
    refute Repo.get(ProviderSession, id)
    task = Repo.get_by!(ErasureTask, kind: "provider", reference: id)
    assert_receive {:didit, "DELETE", _, %{"deletion_instruction" => "privacy_erasure"}}
    DiditStub.stub(delete_status: 404)
    ErasureTasks.sweep(DateTime.add(now(), 120))
    refute Repo.get(ErasureTask, task.id)
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
