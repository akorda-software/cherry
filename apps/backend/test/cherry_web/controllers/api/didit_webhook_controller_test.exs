defmodule CherryWeb.Controllers.Api.DiditWebhookControllerTest do
  use CherryWeb.ConnCase, async: false
  use Oban.Testing, repo: Cherry.Repo

  import ExUnit.CaptureLog

  alias Cherry.Identity.ProviderDecisionWorker
  alias Cherry.Repo
  alias Cherry.TestSupport.DiditStub

  @secret "test-didit-webhook-secret"
  @user_id "99999999-8888-4777-8666-555555555555"

  setup do
    previous = Application.get_env(:cherry, :didit)
    on_exit(fn -> Application.put_env(:cherry, :didit, previous) end)
    :ok
  end

  # The v3 envelope of a status.updated event, with Didit's decision.
  defp event(status, extra \\ %{}) do
    Map.merge(
      %{
        "event_id" => Ecto.UUID.generate(),
        "webhook_type" => "status.updated",
        "timestamp" => System.system_time(:second),
        "environment" => "live",
        "session_id" => DiditStub.session_id(),
        "status" => status,
        "workflow_id" => "test-didit-workflow",
        "vendor_data" => @user_id,
        "decision" => DiditStub.decision(@user_id, status)
      },
      extra
    )
  end

  defp sign(body, secret \\ @secret),
    do: :crypto.mac(:hmac, :sha256, secret, body) |> Base.encode16(case: :lower)

  defp notify(conn, payload, opts \\ []) do
    body = Jason.encode!(payload)
    timestamp = Keyword.get(opts, :timestamp, System.system_time(:second))

    conn
    |> put_req_header("content-type", "application/json")
    |> put_req_header("x-timestamp", Integer.to_string(timestamp))
    |> put_req_header("x-signature", Keyword.get_lazy(opts, :signature, fn -> sign(body) end))
    |> post("/api/webhooks/didit", body)
  end

  test "a final status schedules the check of the session a minute later", %{conn: conn} do
    for status <- ["Approved", "Declined", "Expired", "Kyc Expired", "Abandoned"] do
      assert conn |> notify(event(status)) |> response(200) == ""

      assert_enqueued(
        worker: ProviderDecisionWorker,
        args: %{session_id: DiditStub.session_id()},
        scheduled_at: {DateTime.add(DateTime.utc_now(), 60), delta: 10}
      )

      Repo.delete_all(Oban.Job)
    end
  end

  test "repeated notices of one session schedule a single check", %{conn: conn} do
    assert conn |> notify(event("Approved")) |> response(200)
    assert conn |> notify(event("Approved")) |> response(200)

    assert [_] = all_enqueued(worker: ProviderDecisionWorker)
  end

  test "other statuses and events are acknowledged without work", %{conn: conn} do
    for payload <- [
          event("Not Started"),
          event("In Progress"),
          event("In Review"),
          event("Resubmitted"),
          event("Approved", %{"session_id" => "not-a-session"}),
          %{"webhook_type" => "data.updated", "session_id" => DiditStub.session_id()}
        ] do
      assert conn |> notify(payload) |> response(200)
    end

    refute_enqueued(worker: ProviderDecisionWorker)
  end

  test "a wrong or missing signature is refused", %{conn: conn} do
    payload = event("Approved")
    body = Jason.encode!(payload)

    for signature <- [sign(body, "another-secret"), sign(body <> " "), "", "zz"] do
      assert %{"error" => "invalid_signature"} =
               conn |> notify(payload, signature: signature) |> json_response(401)
    end

    assert %{"error" => "invalid_signature"} =
             conn
             |> put_req_header("content-type", "application/json")
             |> put_req_header("x-timestamp", Integer.to_string(System.system_time(:second)))
             |> post("/api/webhooks/didit", body)
             |> json_response(401)

    refute_enqueued(worker: ProviderDecisionWorker)
  end

  test "a timestamp more than five minutes away is refused", %{conn: conn} do
    now = System.system_time(:second)

    for timestamp <- [now - 301, now + 301] do
      assert conn |> notify(event("Approved"), timestamp: timestamp) |> json_response(401)
    end

    assert conn |> notify(event("Approved"), timestamp: now - 290) |> response(200)
  end

  test "without the secret it is unavailable", %{conn: conn} do
    Application.put_env(
      :cherry,
      :didit,
      Keyword.put(Application.get_env(:cherry, :didit), :webhook_secret, nil)
    )

    assert %{"error" => "webhook_unavailable"} =
             conn |> notify(event("Approved")) |> json_response(503)

    refute_enqueued(worker: ProviderDecisionWorker)
  end

  test "the holder's data in the body is not logged", %{conn: conn} do
    level = Logger.level()
    Logger.configure(level: :debug)
    on_exit(fn -> Logger.configure(level: level) end)

    log =
      capture_log([level: :debug], fn ->
        assert conn |> notify(event("Approved")) |> response(200)
      end)

    for secret <- ["PRUEBA", "FICTICIA", "ZZZ000001", "99999999R", "1990-01-01", @user_id] do
      refute log =~ secret
    end
  end
end
