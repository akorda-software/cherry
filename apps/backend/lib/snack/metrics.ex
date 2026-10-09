defmodule Snack.Metrics do
  @moduledoc "Low-cardinality runtime metrics for sustained load tests and operations."

  import Telemetry.Metrics

  def reporter do
    {Peep, name: __MODULE__, metrics: metrics(), storage: :striped}
  end

  def scrape, do: Peep.get_all_metrics(__MODULE__) |> Peep.Prometheus.export()

  def metrics do
    [
      distribution("snack.http.duration.microseconds",
        event_name: [:phoenix, :router_dispatch, :stop],
        measurement: :duration,
        unit: {:native, :microsecond},
        tags: [:route, :status],
        reporter_options: [peep_bucket_calculator: Snack.Metrics.LatencyBuckets],
        tag_values: &%{route: &1.route, status: &1.conn.status}
      ),
      counter("snack.http.exceptions",
        event_name: [:phoenix, :router_dispatch, :exception],
        tags: [:route]
      ),
      histogram("snack.db.query.microseconds", [:snack, :repo, :query], :query_time),
      histogram("snack.db.queue.microseconds", [:snack, :repo, :query], :queue_time),
      histogram("snack.db.decode.microseconds", [:snack, :repo, :query], :decode_time),
      histogram("snack.socket.connect.microseconds", [:phoenix, :socket_connected], :duration),
      histogram("snack.channel.join.microseconds", [:phoenix, :channel_joined], :duration),
      distribution("snack.channel.event.microseconds",
        event_name: [:phoenix, :channel_handled_in],
        measurement: :duration,
        unit: {:native, :microsecond},
        tags: [:event],
        reporter_options: [peep_bucket_calculator: Snack.Metrics.LatencyBuckets],
        # Client-supplied event strings must not create an unbounded metric series.
        tag_values: &%{event: channel_event(&1.event)}
      ),
      distribution("snack.push.duration.microseconds",
        event_name: [:oban, :job, :stop],
        measurement: :duration,
        unit: {:native, :microsecond},
        tags: [:queue],
        tag_values: &%{queue: &1.job.queue},
        reporter_options: [peep_bucket_calculator: Snack.Metrics.LatencyBuckets]
      ),
      distribution("snack.push.queue.microseconds",
        event_name: [:oban, :job, :stop],
        measurement: :queue_time,
        unit: {:native, :microsecond},
        tags: [:queue],
        tag_values: &%{queue: &1.job.queue},
        reporter_options: [peep_bucket_calculator: Snack.Metrics.LatencyBuckets]
      ),
      counter("snack.push.failures",
        event_name: [:oban, :job, :exception],
        tags: [:queue],
        tag_values: &%{queue: &1.job.queue}
      ),
      last_value("vm.memory.total", unit: :byte),
      last_value("vm.system_counts.process_count"),
      last_value("vm.total_run_queue_lengths.total")
    ]
  end

  defp histogram(name, event, measurement) do
    distribution(name,
      event_name: event,
      measurement: measurement,
      unit: {:native, :microsecond},
      reporter_options: [peep_bucket_calculator: Snack.Metrics.LatencyBuckets]
    )
  end

  defp channel_event(event) when event in ["send_message", "typing"], do: event
  defp channel_event(_event), do: "other"
end
