defmodule SnackWeb.TokenAuth do
  @moduledoc """
  Shared token verification logic used by the REST auth plug and the WebSocket socket.
  """

  alias Snack.Accounts
  alias Snack.Auth

  @spec verify_token(String.t()) :: {:ok, map()} | {:error, atom()}
  def verify_token(token) do
    case Phoenix.Token.verify(SnackWeb.Endpoint, Auth.access_token_salt(), token, []) do
      {:ok, claims} -> {:ok, claims}
      {:error, _reason} -> {:error, :invalid_token}
    end
  end

  @spec fetch_user(map()) :: {:ok, struct()} | {:error, atom()}
  def fetch_user(%{sub: user_id}) do
    case Accounts.get_user!(user_id) do
      user -> {:ok, user}
    end
  rescue
    Ecto.NoResultsError -> {:error, :user_not_found}
  end

  def fetch_user(_claims), do: {:error, :invalid_claims}

  @spec authenticate(String.t() | nil) :: {:ok, map()} | {:error, atom()}
  def authenticate(nil), do: {:error, :missing_token}

  def authenticate("Bearer " <> token), do: authenticate(token)

  def authenticate(token) when is_binary(token) do
    with {:ok, claims} <- verify_token(token),
         {:ok, user} <- fetch_user(claims) do
      {:ok, %{user: user, claims: claims}}
    end
  end

  def authenticate(_), do: {:error, :invalid_format}
end
