defmodule Cherry.Identity.ProviderDecisionWorker do
  @moduledoc """
  Settles a Didit session after Didit reports a final status
  (`CherryWeb.Controllers.Api.DiditWebhookController`) with the same check the
  app runs (`AgeVerifications.check_provider/3`): sessions the app never asks
  about again, because the user closed it during the flow, the session
  expired or a person decided it after a manual review, are stored or refused
  and erased at Didit all the same. A minor's document erases the account, as
  in the app.

  Runs a minute after the notice: the app asks as soon as the user comes back
  and usually settles the session first, so there is nothing left to do.
  Sessions that are not registered (`verification_provider_sessions`) are
  ignored. Didit failures are retried with Oban's backoff.
  """
  use Oban.Worker,
    queue: :verification,
    max_attempts: 15,
    unique: [keys: [:session_id], period: :infinity, states: :incomplete]

  alias Cherry.Accounts
  alias Cherry.Accounts.User
  alias Cherry.Identity.{AgeVerifications, ProviderSession}
  alias Cherry.Repo

  @delay_seconds 60

  @doc "Schedules the check of a session (once while one is pending)."
  def enqueue(session_id),
    do: %{session_id: session_id} |> new(schedule_in: @delay_seconds) |> Oban.insert()

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"session_id" => session_id}}) do
    with %ProviderSession{user_id: user_id} <-
           Repo.get(ProviderSession, session_id, log: false),
         %User{deleted_at: nil} = user <- Repo.get(User, user_id, log: false) do
      user |> AgeVerifications.check_provider(session_id) |> settle(user)
    else
      _settled_or_unknown -> :ok
    end
  end

  @impl Oban.Worker
  def timeout(_job), do: :timer.minutes(1)

  defp settle({:error, :underage}, user) do
    case Accounts.purge_account(user) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  # Didit, the network or the configuration may come back.
  defp settle({:error, reason}, _user)
       when reason in [:provider_error, :unavailable, :internal_error],
       do: {:error, reason}

  defp settle(_outcome, _user), do: :ok
end
