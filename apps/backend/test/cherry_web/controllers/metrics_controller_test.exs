defmodule CherryWeb.MetricsControllerTest do
  use CherryWeb.ConnCase, async: false

  setup do
    original = Application.get_env(:cherry, :metrics_token)

    on_exit(fn ->
      if original,
        do: Application.put_env(:cherry, :metrics_token, original),
        else: Application.delete_env(:cherry, :metrics_token)
    end)

    :ok
  end

  test "metrics are disabled without an explicit token", %{conn: conn} do
    Application.delete_env(:cherry, :metrics_token)
    assert conn |> get("/metrics") |> response(404) == "Not found"
  end

  test "metrics require their token and accept the Prometheus content type", %{conn: conn} do
    Application.put_env(:cherry, :metrics_token, "metrics-test-secret")
    assert conn |> get("/metrics") |> response(401) == "Unauthorized"

    assert conn
           |> put_req_header("authorization", "Bearer wrong")
           |> get("/metrics")
           |> response(401) == "Unauthorized"

    :telemetry.execute(
      [:cherry, :repo, :query],
      %{query_time: 100_000, queue_time: 50_000, decode_time: 1000},
      %{}
    )

    conn =
      conn
      |> put_req_header("authorization", "Bearer metrics-test-secret")
      |> put_req_header("accept", "text/plain")
      |> get("/metrics")

    assert response(conn, 200) =~ "cherry_db_queue_microseconds_bucket"
    assert response(conn, 200) =~ ~s(le="5.0e3")
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "histograms aggregate without retaining one row per query" do
    event = [:cherry, :repo, :query]
    measurement = %{query_time: 100_000, queue_time: 50_000, decode_time: 1000}
    :telemetry.execute(event, measurement, %{})
    before = Peep.storage_size(Cherry.Metrics)
    for _ <- 1..20_000, do: :telemetry.execute(event, measurement, %{})
    after_metrics = Peep.storage_size(Cherry.Metrics)
    assert after_metrics.size <= before.size + 100
    assert after_metrics.memory <= before.memory + 100_000
  end
end
