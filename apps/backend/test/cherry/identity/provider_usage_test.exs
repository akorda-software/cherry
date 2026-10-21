defmodule Cherry.Identity.ProviderUsageTest do
  use Cherry.DataCase, async: false

  @moduletag :capture_log

  alias Cherry.Identity.ProviderUsage

  @now ~U[2026-10-31 23:59:59Z]

  setup do
    previous = Application.get_env(:cherry, :didit)
    on_exit(fn -> Application.put_env(:cherry, :didit, previous) end)
    :ok
  end

  defp limit(value) do
    Application.put_env(
      :cherry,
      :didit,
      Keyword.put(Application.get_env(:cherry, :didit), :monthly_limit, value)
    )
  end

  test "without a limit it only counts" do
    limit(nil)

    for _ <- 1..3, do: assert({:ok, ~D[2026-10-01]} = ProviderUsage.reserve(@now))

    assert ProviderUsage.used(@now) == 3
    refute ProviderUsage.limit_reached?(@now)
  end

  test "never goes over the limit and counts each calendar month (UTC) apart" do
    limit(2)

    assert {:ok, month} = ProviderUsage.reserve(@now)
    assert {:ok, ^month} = ProviderUsage.reserve(@now)
    assert {:error, :provider_limit_reached} = ProviderUsage.reserve(@now)
    assert ProviderUsage.used(@now) == 2
    assert ProviderUsage.limit_reached?(@now)

    november = DateTime.add(@now, 1, :second)
    refute ProviderUsage.limit_reached?(november)
    assert {:ok, ~D[2026-11-01]} = ProviderUsage.reserve(november)
  end

  test "concurrent reservations stop exactly at the limit" do
    limit(5)

    results =
      1..20
      |> Task.async_stream(fn _ -> ProviderUsage.reserve(@now) end, max_concurrency: 20)
      |> Enum.map(fn {:ok, result} -> result end)

    assert Enum.count(results, &match?({:ok, _}, &1)) == 5
    assert ProviderUsage.used(@now) == 5
  end

  test "a released slot can be taken again, and a limit of 0 stops everything" do
    limit(1)
    assert {:ok, month} = ProviderUsage.reserve(@now)
    assert :ok = ProviderUsage.release(month)
    assert ProviderUsage.used(@now) == 0
    assert {:ok, _} = ProviderUsage.reserve(@now)

    limit(0)
    assert {:error, :provider_limit_reached} = ProviderUsage.reserve(~U[2027-01-15 10:00:00Z])
    assert ProviderUsage.limit_reached?(~U[2027-01-15 10:00:00Z])
  end
end
