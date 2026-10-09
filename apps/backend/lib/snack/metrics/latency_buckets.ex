defmodule Snack.Metrics.LatencyBuckets do
  @moduledoc false

  # Microseconds: Peep stores histogram sums as integers. Keep submillisecond
  # probes precise and use bounded buckets for fast DB queries and slow pushes.
  use Peep.Buckets.Custom,
    buckets: [
      50,
      100,
      250,
      500,
      1000,
      2500,
      5000,
      10_000,
      25_000,
      50_000,
      100_000,
      250_000,
      500_000,
      1_000_000,
      2_500_000,
      5_000_000,
      10_000_000,
      30_000_000,
      60_000_000
    ]
end
