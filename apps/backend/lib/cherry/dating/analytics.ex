defmodule Cherry.Dating.Analytics do
  @moduledoc "Dating analytics event persistence."

  alias Cherry.Repo
  alias Cherry.Dating.AnalyticsEvent

  # ── Analytics ─────────────────────────────────────────────────────────

  @doc """
  Tracks an analytics event.
  """
  def track_event(attrs \\ %{}) do
    %AnalyticsEvent{}
    |> AnalyticsEvent.changeset(attrs)
    |> Repo.insert()
  end
end
