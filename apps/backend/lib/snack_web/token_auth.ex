defmodule SnackWeb.TokenAuth do
  @moduledoc """
  Shared token verification logic used by the REST auth plug and the WebSocket socket.
  """

  alias Snack.Accounts
  alias Snack.Auth
  alias Snack.Sessions

  @spec verify_token(String.t()) :: {:ok, map()} | {:error, atom()}
  def verify_token(token) do
    with {:ok, claims} <-
           Phoenix.Token.verify(SnackWeb.Endpoint, Auth.access_token_salt(), token, []),
         :ok <- validate_expiration(claims) do
      {:ok, claims}
    else
      {:error, reason} when is_atom(reason) -> {:error, reason}
      _error -> {:error, :invalid_token}
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
         :ok <- validate_session(claims),
         {:ok, user} <- fetch_user(claims) do
      {:ok, %{user: user, claims: claims}}
    end
  end

  def authenticate(_), do: {:error, :invalid_format}

  defp validate_expiration(%{exp: exp}) when is_integer(exp) do
    if exp > System.os_time(:second) do
      :ok
    else
      {:error, :token_expired}
    end
  end

  defp validate_expiration(_claims), do: {:error, :invalid_claims}

  defp validate_session(%{sub: user_id, session_id: session_family_id}) do
    if Sessions.active_session_family?(session_family_id, user_id) do
      :ok
    else
      {:error, :session_revoked}
    end
  end

  defp validate_session(_claims), do: {:error, :invalid_claims}
end
