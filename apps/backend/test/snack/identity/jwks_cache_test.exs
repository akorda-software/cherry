defmodule Snack.Identity.JwksCacheTest do
  use ExUnit.Case, async: false

  alias Snack.Identity.Providers.AppleJwksCache
  alias Snack.Identity.Providers.GoogleJwksCache

  setup do
    previous_options = Req.default_options()
    previous_config = Application.get_env(:snack, AppleJwksCache)
    owner = self()

    Req.default_options(
      retry: false,
      plug: fn conn ->
        send(owner, {:jwks_fetch, self()})
        Req.Test.json(conn, %{"keys" => [%{"kid" => "test-key"}]})
      end
    )

    Application.put_env(:snack, AppleJwksCache, ttl_ms: 60_000)
    reset_cache()

    on_exit(fn ->
      Req.default_options(previous_options)
      Application.put_env(:snack, AppleJwksCache, previous_config)
      reset_cache()
    end)

    :ok
  end

  test "cached keys survive the request process that first fetched them" do
    task = Task.async(&AppleJwksCache.get/0)
    assert {:ok, [%{"kid" => "test-key"}]} = Task.await(task)
    assert_receive {:jwks_fetch, _}
    monitor = Process.monitor(task.pid)
    assert_receive {:DOWN, ^monitor, :process, _, _}

    assert :ets.whereis(AppleJwksCache) != :undefined
    assert {:ok, [%{"kid" => "test-key"}]} = AppleJwksCache.get()
    refute_receive {:jwks_fetch, _}
  end

  test "a burst of sign-ins shares one cold-cache HTTP request" do
    tasks = for _ <- 1..30, do: Task.async(&AppleJwksCache.get/0)
    results = Task.await_many(tasks)

    assert Enum.all?(results, &(&1 == {:ok, [%{"kid" => "test-key"}]}))
    assert_receive {:jwks_fetch, _}
    refute_receive {:jwks_fetch, _}
  end

  test "an unavailable provider is cached briefly so queued sign-ins do not retry it" do
    owner = self()

    Req.default_options(
      retry: false,
      plug: fn conn ->
        send(owner, {:jwks_fetch, self()})
        Plug.Conn.send_resp(conn, 503, "unavailable")
      end
    )

    tasks = for _ <- 1..30, do: Task.async(&AppleJwksCache.get/0)
    assert Enum.all?(Task.await_many(tasks), &(&1 == {:error, :apple_jwks_unavailable}))
    assert_receive {:jwks_fetch, _}
    refute_receive {:jwks_fetch, _}
  end

  test "expired keys remain usable during a provider outage, with retry backoff" do
    Application.put_env(:snack, AppleJwksCache, ttl_ms: 0)
    assert {:ok, keys} = AppleJwksCache.get()
    assert_receive {:jwks_fetch, _}
    owner = self()

    Req.default_options(
      retry: false,
      plug: fn conn ->
        send(owner, {:jwks_fetch, self()})
        Plug.Conn.send_resp(conn, 503, "unavailable")
      end
    )

    assert AppleJwksCache.get() == {:ok, keys}
    assert_receive {:jwks_fetch, _}
    assert AppleJwksCache.get() == {:ok, keys}
    refute_receive {:jwks_fetch, _}
  end

  test "Google keys also belong to a supervised owner" do
    assert {:ok, [%{"kid" => "test-key"}]} = Task.async(&GoogleJwksCache.get/0) |> Task.await()
    assert :ets.info(GoogleJwksCache, :owner) == Process.whereis(GoogleJwksCache)
  end

  test "JWKS downloads use valid options on the real HTTP transport" do
    Req.default_options([])

    server =
      start_supervised!(
        {Bandit,
         plug: fn conn, _opts -> Req.Test.json(conn, %{keys: [%{kid: "wire-key"}]}) end,
         ip: {127, 0, 0, 1},
         port: 0,
         startup_log: false}
      )

    {:ok, {_ip, port}} = ThousandIsland.listener_info(server)
    Application.put_env(:snack, AppleJwksCache, jwks_url: "http://127.0.0.1:#{port}")

    assert {:ok, [%{"kid" => "wire-key"}]} = AppleJwksCache.get()
  end

  defp reset_cache do
    for cache <- [AppleJwksCache, GoogleJwksCache] do
      case Supervisor.terminate_child(Snack.Supervisor, cache) do
        :ok -> Supervisor.restart_child(Snack.Supervisor, cache)
        {:error, :not_found} -> :ok
      end
    end
  end
end
