defmodule Snack.Accounts do
  @moduledoc false

  alias Snack.Accounts.User
  alias Snack.Repo

  def create_user(attrs) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end

  def get_user!(id), do: Repo.get!(User, id)

  @test_user_email "test@snack.app"

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
