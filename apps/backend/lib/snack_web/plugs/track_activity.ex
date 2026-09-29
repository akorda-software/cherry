defmodule SnackWeb.Plugs.TrackActivity do
  @moduledoc """
  Marks the authenticated profile as active (`profiles.last_active_at`), the
  activity signal of the discovery ranking.

  Must run after `SnackWeb.Plugs.Authenticate`. Costs nothing while the loaded
  value is under 15 minutes old and at most one guarded UPDATE by primary key
  otherwise. A failure here is logged and never fails the request.
  """

  require Logger

  alias Snack.Dating.Discovery

  def init(opts), do: opts

  def call(
        %Plug.Conn{assigns: %{current_profile: %Snack.Dating.Profile{} = profile}} = conn,
        _opts
      ) do
    try do
      Discovery.record_activity(profile)
    rescue
      error -> Logger.warning("Could not record profile activity: #{Exception.message(error)}")
    end

    conn
  end

  def call(conn, _opts), do: conn
end
