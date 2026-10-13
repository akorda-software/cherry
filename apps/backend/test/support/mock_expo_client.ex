defmodule Cherry.Notifications.MockExpoClient do
  @moduledoc """
  Mock Expo client for tests. It sends payloads to the calling test process.
  """

  @behaviour Cherry.Notifications.ExpoClient

  @impl true
  def send_messages(messages, _opts) do
    if test_pid = Process.get(:expo_push_test_pid) do
      send(test_pid, {:expo_push_messages, messages})
    end

    Process.get(:expo_push_test_result, {:ok, Enum.map(messages, &ticket_for/1)})
  end

  defp ticket_for(%{"to" => token}) do
    if String.contains?(token, "DeviceNotRegistered") do
      %{
        "status" => "error",
        "message" => "#{token} is not a registered push notification recipient",
        "details" => %{"error" => "DeviceNotRegistered"}
      }
    else
      %{"status" => "ok", "id" => "ticket-#{:erlang.phash2(token)}"}
    end
  end
end
