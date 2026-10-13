defmodule Cherry.Identity.JwksCache do
  @moduledoc """
  Supervised provider-key cache. Fresh keys are read directly from ETS; a single
  owner downloads missing/expired keys and rechecks the cache for queued callers.
  Failed fetches retain existing keys and back off, including on a cold cache.
  """

  use GenServer

  @default_ttl_ms :timer.minutes(10)
  @default_retry_ms :timer.seconds(30)
  @request_timeout_ms 5_000
  @call_timeout_ms 20_000

  def child_spec(opts) do
    %{id: Keyword.fetch!(opts, :name), start: {__MODULE__, :start_link, [opts]}}
  end

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.fetch!(opts, :name))
  end

  def get(name, unavailable_error) do
    case cached(name) do
      nil -> GenServer.call(name, :get, @call_timeout_ms)
      result -> result
    end
  catch
    :exit, _reason -> {:error, unavailable_error}
  end

  @impl true
  def init(opts) do
    name = Keyword.fetch!(opts, :name)
    :ets.new(name, [:named_table, :protected, :set, read_concurrency: true])

    {:ok,
     %{
       name: name,
       url: Keyword.fetch!(opts, :jwks_url),
       unavailable_error: Keyword.fetch!(opts, :unavailable_error),
       keys: []
     }}
  end

  @impl true
  def handle_call(:get, _from, state) do
    case cached(state.name) do
      nil ->
        {result, state, ttl} = refresh(state)
        :ets.insert(state.name, {:jwks, result, now_ms() + ttl})
        {:reply, result, state}

      result ->
        {:reply, result, state}
    end
  end

  defp cached(name) do
    case :ets.lookup(name, :jwks) do
      [{:jwks, result, expires_at}] -> if expires_at > now_ms(), do: result
      [] -> nil
    end
  rescue
    # A supervisor restart can briefly leave the table absent. The subsequent
    # call either reaches the restarted owner or returns provider unavailable.
    ArgumentError -> nil
  end

  defp refresh(state) do
    config = Application.get_env(:cherry, state.name, [])

    options =
      [
        retry: false,
        receive_timeout: @request_timeout_ms,
        finch: [
          pool_timeout: @request_timeout_ms,
          conn_opts: [transport_opts: [timeout: @request_timeout_ms]]
        ]
      ]
      |> Keyword.merge(Keyword.get(config, :request_options, []))

    case Req.get(Keyword.get(config, :jwks_url, state.url), options) do
      {:ok, %Req.Response{status: 200, body: %{"keys" => keys}}}
      when is_list(keys) and keys != [] ->
        {{:ok, keys}, %{state | keys: keys}, Keyword.get(config, :ttl_ms, @default_ttl_ms)}

      _error ->
        result =
          if state.keys == [],
            do: {:error, state.unavailable_error},
            else: {:ok, state.keys}

        {result, state, Keyword.get(config, :retry_ms, @default_retry_ms)}
    end
  end

  defp now_ms, do: System.monotonic_time(:millisecond)
end
