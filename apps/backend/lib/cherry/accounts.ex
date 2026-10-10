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
        # Photos are deleted physically (retried by the sweeper on failure).
        Cherry.Dating.PhotoStorage.purge_user_photos(user_id)
        {:ok, :deleted}

      error ->
        error
    end
  end

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
      from u in User,
        where: fragment("lower(?)", u.email) == ^email,
        order_by: [asc: u.inserted_at],
        limit: 1
    )
  end
end
