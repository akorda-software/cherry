defmodule Snack.Auth do
  @moduledoc false

  require Logger

  @config_key __MODULE__

  def access_token_ttl_seconds, do: Keyword.fetch!(config(), :access_token_ttl_seconds)
  def refresh_token_ttl_days, do: Keyword.fetch!(config(), :refresh_token_ttl_days)
  def access_token_salt, do: Keyword.fetch!(config(), :access_token_salt)
  def refresh_token_salt, do: Keyword.fetch!(config(), :refresh_token_salt)

  def provider_module(provider) do
    provider
    |> provider_config()
    |> Keyword.fetch!(:module)
  end

  def provider_config(provider) do
    config()
    |> Keyword.fetch!(:providers)
    |> Map.fetch!(provider)
    |> normalize_provider_config()
  end

  def supported_provider?(provider) when is_atom(provider) do
    config()
    |> Keyword.fetch!(:providers)
    |> Map.has_key?(provider)
  end

  def supported_provider?(_provider), do: false

  @doc """
  Proveedores configurados con `audiences: []` (rechazarán todos los tokens).
  Los proveedores sin lista de audiencias (config de tests/dev) no cuentan.
  """
  def providers_without_audiences do
    config()
    |> Keyword.get(:providers, %{})
    |> Enum.filter(fn {_provider, provider_config} ->
      provider_config |> normalize_provider_config() |> Keyword.get(:audiences) == []
    end)
    |> Enum.map(&elem(&1, 0))
    |> Enum.sort()
  end

  @doc """
  Avisa al arrancar si algún proveedor no tiene audiencias: sin ellas todos sus
  logins fallan en silencio. No detiene el arranque (una instancia puede usar
  solo Apple, o solo Google).
  """
  def warn_missing_audiences do
    missing = providers_without_audiences()
    configured = config() |> Keyword.get(:providers, %{}) |> Map.keys()

    cond do
      missing == [] ->
        :ok

      Enum.sort(configured) == missing ->
        Logger.error(
          "No sign-in provider has audiences configured: EVERY login will be rejected. " <>
            "Set GOOGLE_WEB_CLIENT_ID / GOOGLE_IOS_CLIENT_ID and/or APPLE_AUDIENCES."
        )

      true ->
        Enum.each(missing, fn provider ->
          Logger.warning(
            "Sign-in provider #{provider} has no audiences configured: its logins will be rejected " <>
              "(#{audience_env_hint(provider)})."
          )
        end)
    end
  end

  defp audience_env_hint(:google), do: "set GOOGLE_WEB_CLIENT_ID and/or GOOGLE_IOS_CLIENT_ID"
  defp audience_env_hint(:apple), do: "set APPLE_AUDIENCES"
  defp audience_env_hint(_provider), do: "configure its audiences"

  defp config, do: Application.fetch_env!(:snack, @config_key)

  defp normalize_provider_config(provider_config) when is_atom(provider_config) do
    [module: provider_config]
  end

  defp normalize_provider_config(provider_config) when is_list(provider_config),
    do: provider_config
end
