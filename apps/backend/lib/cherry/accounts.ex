defmodule Cherry.Accounts do
  @moduledoc false

  import Ecto.Query

  alias Cherry.Accounts.User
  alias Cherry.Repo

  def create_user(attrs) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end

  def get_user!(id), do: Repo.get!(User, id)

  @doc "Deactivates an account and all its credentials atomically; retains records for now."
  def delete_account(%User{id: user_id}) do
    Repo.transaction(fn ->
      user = Repo.one!(from u in User, where: u.id == ^user_id, lock: "FOR UPDATE")
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      Repo.update!(Ecto.Changeset.change(user, deleted_at: user.deleted_at || now))

      from(p in Cherry.Dating.Profile, where: p.user_id == ^user_id)
      |> Repo.update_all(set: [deleted_at: now, is_discoverable: false, is_paused: true])

      Cherry.Sessions.revoke_user_sessions(user_id)
      :ok
    end)
    |> case do
      {:ok, :ok} ->
        CherryWeb.Endpoint.broadcast("user_socket:#{user_id}", "disconnect", %{})
        {:ok, :deleted}

      error ->
        error
    end
  end

  @test_user_email "test@cherry.app"

  def ensure_test_user do
    case Repo.get_by(User, email: @test_user_email) do
      %User{} = user ->
        {:ok, user}

      nil ->
        case create_user(%{email: @test_user_email, display_name: "Test User"}) do
          {:ok, user} ->
            {:ok, user}

          {:error, _changeset} ->
            case Repo.get_by(User, email: @test_user_email) do
              %User{} = user -> {:ok, user}
              nil -> {:error, :failed_to_ensure_test_user}
            end
        end
    end
  end
end
