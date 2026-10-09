defmodule Snack.Dating.Analytics do
  @moduledoc "Dating analytics event persistence."

  alias Snack.Repo
  alias Snack.Dating.AnalyticsEvent

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
