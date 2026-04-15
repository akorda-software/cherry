defmodule Snack.Auth do
  @moduledoc false

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

  defp config, do: Application.fetch_env!(:snack, @config_key)

  defp normalize_provider_config(provider_config) when is_atom(provider_config) do
    [module: provider_config]
  end

  defp normalize_provider_config(provider_config) when is_list(provider_config),
    do: provider_config
end
