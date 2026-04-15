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
end
