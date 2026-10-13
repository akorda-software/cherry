defmodule Cherry.Dating.ChatBroadcastWorker do
  @moduledoc """
  Post-commit broadcast fallback for sends composed inside a caller transaction.
  Normal REST/WebSocket sends broadcast directly after their own commit.
  """

  use Oban.Worker, queue: :push, max_attempts: 3, priority: 0

  alias Cherry.Dating.{Message, Messaging}
  alias Cherry.Repo

  def enqueue(message_id), do: %{message_id: message_id} |> new() |> Oban.insert()

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"message_id" => message_id}}) do
    case Repo.get(Message, message_id) do
      nil -> {:cancel, :message_deleted}
      message -> Messaging.broadcast_new_message(message)
    end
  end

  @impl Oban.Worker
  def timeout(_job), do: :timer.seconds(5)
end
