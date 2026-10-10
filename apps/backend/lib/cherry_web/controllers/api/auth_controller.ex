defmodule CherryWeb.Controllers.Api.AuthController do
  use CherryWeb, :controller

  alias Cherry.Accounts
  alias Cherry.Identity
  alias Cherry.Sessions

  def create(conn, %{"provider" => provider} = params) do
    with {:ok, resolved_provider} <- parse_provider(provider),
         {:ok, %{user: user}} <-
           Identity.resolve_provider_login(resolved_provider, normalize_params(params)),
         {:ok, issued} <- Sessions.issue_session(user, normalize_device(params)) do
      conn
      |> put_status(:created)
      |> json(session_payload(issued.session))
    else
      {:error, reason} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: Atom.to_string(reason)})
    end
  end

  def test_login(conn, params) do
    if dev_test_login_enabled?() do
      with {:ok, user} <- Accounts.ensure_test_user(),
           {:ok, issued} <- Sessions.issue_session(user, normalize_device(params)) do
        conn
        |> put_status(:created)
        |> json(session_payload(issued.session))
      else
        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{error: Atom.to_string(reason)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "dev_test_login_disabled"})
    end
  end

  defp dev_test_login_enabled? do
    Application.get_env(:cherry, :enable_dev_test_login, false) in [true, "true"]
  end

  defp normalize_params(params) do
    %{
      provider_token: Map.get(params, "providerToken"),
      id_token: Map.get(params, "idToken"),
      authorization_code: Map.get(params, "authorizationCode"),
      nonce: Map.get(params, "nonce")
    }
  end

  defp normalize_device(%{"device" => device}) do
    %{
      installation_id: Map.fetch!(device, "installationId"),
      platform: Map.fetch!(device, "platform"),
      device_name: Map.fetch!(device, "deviceName")
    }
  end

  defp normalize_device(_params) do
    %{
      installation_id: "dev-test-device",
      platform: "android",
      device_name: "Dev Test Device"
    }
  end

  defp parse_provider("google"), do: {:ok, :google}
  defp parse_provider("apple"), do: {:ok, :apple}
  defp parse_provider(_provider), do: {:error, :unsupported_provider}

  defp session_payload(session) do
    %{
      accessToken: session.access_token,
      accessTokenExpiresAt: session.access_token_expires_at,
      refreshToken: session.refresh_token,
      refreshTokenExpiresAt: session.refresh_token_expires_at,
      user: %{
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.display_name
      }
    }
  end
end
