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

  @doc "Physically deletes the account, including its identity and document fingerprint."
  def delete_account(%User{} = user) do
    case purge_account(user) do
      {:ok, :purged} -> {:ok, :deleted}
      error -> error
    end
  end

  @doc "Whether the owner deleted the account and may sign up again with the same login."
  def deleted_by_owner?(%User{deleted_at: %DateTime{}, deletion_reason: "user_request"}), do: true
  def deleted_by_owner?(%User{}), do: false

  @doc "Account erasure; external cleanup survives failures without retaining the account."
  def purge_account(%User{} = user), do: Cherry.Accounts.Erasure.delete(user)

  @test_user_email "test@cherry.app"

  @doc """
  Dev-only (`POST /api/auth/dev/test-login`): returns the user to log in as,
  creating it on first use.

  Without `:email` it is the shared test user (`test@cherry.app`). With `:email`
  (matched case-insensitively) it is that persona, e.g. the demo accounts of
  `priv/repo/demo_seeds.exs`; `:display_name` is only used when creating it.
  """
  def ensure_test_user(attrs \\ %{}) do
    email =
      case Map.get(attrs, :email) do
        email when is_binary(email) and email != "" -> email |> String.trim() |> String.downcase()
        _default -> @test_user_email
      end

    display_name =
      case Map.get(attrs, :display_name) do
        name when is_binary(name) and name != "" -> String.trim(name)
        _default when email == @test_user_email -> "Test User"
        _default -> email |> String.split("@") |> hd() |> String.capitalize()
      end

    case get_user_by_email_insensitive(email) do
      %User{} = user ->
        {:ok, user}

      nil ->
        case create_user(%{email: email, display_name: display_name}) do
          {:ok, user} ->
            {:ok, user}

          {:error, changeset} ->
            # Either another request created it first or the email is invalid.
            case get_user_by_email_insensitive(email) do
              %User{} = user ->
                {:ok, user}

              nil ->
                if Keyword.has_key?(changeset.errors, :email),
                  do: {:error, :invalid_email},
                  else: {:error, :failed_to_ensure_test_user}
            end
        end
    end
  end

  defp get_user_by_email_insensitive(email) do
    Repo.one(
      from(u in User,
        where: fragment("lower(?)", u.email) == ^email,
        order_by: [asc: u.inserted_at],
        limit: 1
      )
    )
  end
end
