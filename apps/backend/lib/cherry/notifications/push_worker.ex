defmodule Cherry.Notifications.PushWorker do
  @moduledoc "Durable, bounded push delivery with independent retries per recipient."

  use Oban.Worker,
    queue: :push,
    priority: 1,
    max_attempts: 8

  # Each immutable event is enqueued once by its write transaction. Avoid a
  # uniqueness query over the retained job history on every chat message.

  @impl Oban.Worker
  def perform(%Oban.Job{args: args, inserted_at: inserted_at}) do
    max_age = if args["event"] == "new_message", do: 900, else: 86_400

    if DateTime.diff(DateTime.utc_now(), inserted_at) >= max_age do
      {:cancel, :notification_expired}
    else
      Cherry.Notifications.deliver_event(args)
    end
  end

  @impl Oban.Worker
  def timeout(_job), do: :timer.seconds(30)
end
