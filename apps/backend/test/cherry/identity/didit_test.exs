defmodule Cherry.Identity.DiditTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  alias Cherry.Identity.Didit
  alias Cherry.TestSupport.DiditStub

  @user_id "00000000-0000-4000-8000-000000000001"

  setup do
    previous = Application.get_env(:cherry, :didit)
    on_exit(fn -> Application.put_env(:cherry, :didit, previous) end)
    :ok
  end

  describe "configured?/0" do
    test "needs both the API key and the workflow" do
      config = Application.get_env(:cherry, :didit)
      assert Didit.configured?()

      for missing <- [:api_key, :workflow_id], value <- [nil, ""] do
        Application.put_env(:cherry, :didit, Keyword.put(config, missing, value))
        refute Didit.configured?()
      end
    end
  end

  describe "create_session/2" do
    test "sends the workflow, the user as vendor_data, the callback and the API key" do
      owner = self()

      Req.Test.stub(Didit, fn conn ->
        {:ok, raw, conn} = Plug.Conn.read_body(conn)
        send(owner, {:request, conn, Jason.decode!(raw)})

        conn
        |> Plug.Conn.put_status(201)
        |> Req.Test.json(%{"session_id" => DiditStub.session_id(), "url" => "https://x.test/s"})
      end)

      assert {:ok, %{session_id: id, url: "https://x.test/s"}} =
               Didit.create_session(@user_id, "cherry://verify/selfie")

      assert id == DiditStub.session_id()

      assert_receive {:request, conn, body}
      assert conn.method == "POST"
      assert conn.request_path == "/v3/session/"
      assert Plug.Conn.get_req_header(conn, "x-api-key") == ["test-didit-api-key"]

      assert body == %{
               "workflow_id" => "test-didit-workflow",
               "vendor_data" => @user_id,
               "callback" => "cherry://verify/selfie",
               "callback_method" => "both",
               "language" => "es"
             }
    end

    test "omits the callback when there is none" do
      DiditStub.stub()
      assert {:ok, _} = Didit.create_session(@user_id, nil)
      assert_receive {:didit, "POST", "/v3/session/", body}
      refute Map.has_key?(body, "callback")
    end

    test "errors of the provider become :provider_error and log only the status" do
      DiditStub.stub(create_status: 403)

      log =
        capture_log(fn ->
          assert {:error, :provider_error} = Didit.create_session(@user_id, nil)
        end)

      assert log =~ "HTTP 403"
      refute log =~ @user_id
      refute log =~ "test-didit-api-key"
    end

    test "transport errors become :provider_error" do
      Req.Test.stub(Didit, &Req.Test.transport_error(&1, :timeout))

      log =
        capture_log(fn ->
          assert {:error, :provider_error} = Didit.create_session(@user_id, nil)
        end)

      assert log =~ "transport error"
    end
  end

  describe "get_decision/1" do
    test "keeps only the fields the age check needs" do
      DiditStub.stub(decision: DiditStub.decision(@user_id, "Approved"))

      assert {:ok, decision} = Didit.get_decision(DiditStub.session_id())

      assert decision == %{
               status: "Approved",
               vendor_data: @user_id,
               environment: "sandbox",
               id_verifications: [
                 %{
                   status: "Approved",
                   document_type: "Identity Card",
                   document_number: "ZZZ000001",
                   personal_number: "99999999R",
                   date_of_birth: "1990-01-01",
                   issuing_state: "ESP",
                   expiration_date: "2031-01-01"
                 }
               ]
             }

      path = "/v3/session/#{DiditStub.session_id()}/decision/"
      assert_receive {:didit, "GET", ^path, nil}
    end

    test "a session without document yet" do
      DiditStub.stub(
        decision: DiditStub.decision(@user_id, "Not Started", %{}, %{"id_verifications" => nil})
      )

      assert {:ok, %{status: "Not Started", id_verifications: []}} =
               Didit.get_decision(DiditStub.session_id())
    end

    test "unknown sessions and errors" do
      DiditStub.stub()
      assert {:error, :not_found} = Didit.get_decision(DiditStub.session_id())

      DiditStub.stub(decision: {:status, 500})

      capture_log(fn ->
        assert {:error, :provider_error} = Didit.get_decision(DiditStub.session_id())
      end)
    end
  end

  describe "delete_session/1" do
    test "asks for a privacy erasure" do
      DiditStub.stub()
      assert :ok = Didit.delete_session(DiditStub.session_id())

      path = "/v3/session/#{DiditStub.session_id()}/delete/"
      assert_receive {:didit, "DELETE", ^path, %{"deletion_instruction" => "privacy_erasure"}}
    end

    test "returns the status when it fails" do
      DiditStub.stub(delete_status: 503)
      assert {:error, 503} = Didit.delete_session(DiditStub.session_id())
    end
  end

  describe "erase/1" do
    test "deletes the user record Didit built from vendor_data, then the session" do
      DiditStub.stub(decision: DiditStub.decision(@user_id, "Approved"))
      assert :ok = Didit.erase(DiditStub.session_id())

      decision = "/v3/session/#{DiditStub.session_id()}/decision/"
      assert_receive {:didit, "GET", ^decision, _}
      assert_receive {:didit, "POST", "/v3/users/delete/", %{"vendor_data_list" => [@user_id]}}

      path = "/v3/session/#{DiditStub.session_id()}/delete/"
      assert_receive {:didit, "DELETE", ^path, %{"deletion_instruction" => "privacy_erasure"}}
    end

    test "a session Didit no longer knows is already erased" do
      DiditStub.stub(delete_status: 404)
      assert :ok = Didit.erase(DiditStub.session_id())
      refute_receive {:didit, "POST", "/v3/users/delete/", _}
    end

    test "keeps the session until the user record is deleted" do
      DiditStub.stub(decision: DiditStub.decision(@user_id, "Approved"), delete_user_status: 503)
      assert {:error, 503} = Didit.erase(DiditStub.session_id())
      refute_receive {:didit, "DELETE", _, _}

      DiditStub.stub(decision: {:status, 500})

      capture_log(fn ->
        assert {:error, :provider_error} = Didit.erase(DiditStub.session_id())
      end)

      refute_receive {:didit, "DELETE", _, _}
    end
  end
end
