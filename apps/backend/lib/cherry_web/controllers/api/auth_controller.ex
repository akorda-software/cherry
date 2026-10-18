defmodule CherryWeb.Controllers.Api.AuthController do
  use CherryWeb, :controller

  alias Cherry.Accounts
  alias Cherry.Identity
  alias Cherry.Sessions

  plug(:private_headers)

  def create(conn, %{"provider" => provider} = params) do
    with {:ok, resolved_provider} <- parse_provider(provider),
         {:ok, %{user: user, identity: identity}} <-
           Identity.resolve_provider_login(resolved_provider, normalize_params(params)),
         {:ok, issued} <- Sessions.issue_session(user, normalize_device(params), identity.id) do
      conn
      |> put_status(:created)
      |> json(session_payload(issued.session))
    else
      {:error, %Ecto.Changeset{}} ->
        # Never merge distinct provider identities based only on an email match.
        conn |> put_status(:conflict) |> json(%{error: "identity_conflict"})

      {:error, reason} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: Atom.to_string(reason)})
    end
  end

  defp private_headers(conn, _) do
    conn
    |> put_resp_header("cache-control", "private, no-store")
    |> put_resp_header("referrer-policy", "no-referrer")
  end

  @doc """
  Dev-only login (`:enable_dev_test_login`). Body (all optional):
  `{"email": "demo@cherry.dev", "displayName": "Lucía", "device": {...}}`.
  Without `email` it logs in as the shared test user; with it, as that persona
  (created on first use). `device` may be partial or missing.
  """
  def test_login(conn, params) do
    if dev_test_login_enabled?() do
      with {:ok, attrs} <- test_login_attrs(params),
           {:ok, user} <- Accounts.ensure_test_user(attrs),
           {:ok, issued} <- Sessions.issue_session(user, test_login_device(params)) do
        conn
        |> put_status(:created)
        |> json(session_payload(issued.session))
      else
        {:error, :invalid_email} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "invalid_email"})

        {:error, :account_deleted} ->
          conn
          |> put_status(:forbidden)
          |> json(%{error: "account_deleted"})

        {:error, reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{
            error: if(is_atom(reason), do: Atom.to_string(reason), else: "test_login_failed")
          })
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "dev_test_login_disabled"})
    end
  end

  defp test_login_attrs(params) do
    display_name =
      case Map.get(params, "displayName", Map.get(params, "display_name")) do
        name when is_binary(name) -> name
        _other -> nil
      end

    case Map.get(params, "email") do
      nil -> {:ok, %{display_name: display_name}}
      "" -> {:ok, %{display_name: display_name}}
      email when is_binary(email) -> {:ok, %{email: email, display_name: display_name}}
      _other -> {:error, :invalid_email}
    end
  end

  # The mobile dev button posts `{}`; any provided device fields win.
  defp test_login_device(params) do
    device =
      case Map.get(params, "device") do
        %{} = device -> device
        _missing -> %{}
      end

    %{
      installation_id: device_field(device, "installationId", "dev-test-device"),
      platform: device_field(device, "platform", "android"),
      device_name: device_field(device, "deviceName", "Dev Test Device")
    }
  end

  defp device_field(device, key, default) do
    case Map.get(device, key) do
      value when is_binary(value) and value != "" -> value
      _missing -> default
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
