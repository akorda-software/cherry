defmodule Snack.Identity.Providers.GoogleJwksCache do
  @moduledoc false

  @table __MODULE__
  @jwks_url "https://www.googleapis.com/oauth2/v3/certs"
  @default_ttl_ms :timer.minutes(10)

  def get do
    ensure_table!()

    current_time = now_ms()

    case :ets.lookup(@table, :jwks) do
      [{:jwks, keys, expires_at}] when expires_at > current_time ->
        {:ok, keys}

      [{:jwks, keys, _expires_at}] ->
        refresh(keys)

      [] ->
        refresh([])
    end
  end

  defp refresh(stale_keys) do
    case Req.get(@jwks_url) do
      {:ok, %Req.Response{status: 200, body: %{"keys" => keys}}} when is_list(keys) ->
        :ets.insert(@table, {:jwks, keys, now_ms() + ttl_ms()})
        {:ok, keys}

      _error when stale_keys != [] ->
        {:ok, stale_keys}

      _error ->
        {:error, :google_jwks_unavailable}
    end
  end

  defp ensure_table! do
    case :ets.whereis(@table) do
      :undefined ->
        :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
        :ok

      _table ->
        :ok
    end
  rescue
    ArgumentError -> :ok
  end

  defp ttl_ms do
    Application.get_env(:snack, __MODULE__, [])
    |> Keyword.get(:ttl_ms, @default_ttl_ms)
  end

  defp now_ms, do: System.system_time(:millisecond)
end
