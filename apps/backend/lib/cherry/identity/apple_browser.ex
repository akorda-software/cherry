defmodule Cherry.Identity.AppleBrowser do
  @moduledoc """
  Bounded, ephemeral Apple browser handoff. No identity/session is created by the
  browser callback. Only the initiating app can redeem the one-use handoff with
  its verifier. State and handoff identifiers are stored as hashes, never in DB.
  All requests in a flow must reach this same node; a restart requires retrying.
  """
  use GenServer
  alias Cherry.Identity.{AppleCodeExchange, Providers.Apple}

  @flow_ttl 300_000
  @grant_ttl 60_000
  @capacity 512
  @rate_window 60_000
  @rate_limit 30

  def start_link(opts \\ []),
    do: GenServer.start_link(__MODULE__, opts, name: opts[:name] || __MODULE__)

  def enabled?, do: Application.get_env(:cherry, :apple_browser, [])[:enabled] == true

  def start(params, peer_ip, server \\ __MODULE__) do
    config = Application.get_env(:cherry, :apple_browser, [])

    with true <- enabled?(),
         %{
           "codeChallenge" => challenge,
           "nonce" => nonce,
           "state" => client_state,
           "redirectUri" => redirect
         } <- params,
         true <- valid?(challenge, ~r/\A[A-Za-z0-9_-]{43}\z/),
         true <- valid?(nonce, ~r/\A[0-9a-f]{64}\z/),
         true <- valid?(client_state, ~r/\A[0-9a-f]{64}\z/),
         true <- redirect in config[:app_redirect_uris],
         {:ok, state} <-
           GenServer.call(
             cache(server),
             {:start,
              %{
                challenge: challenge,
                nonce: nonce,
                client_state: client_state,
                redirect: redirect
              }, peer_ip}
           ) do
      query =
        URI.encode_query(%{
          "client_id" => config[:client_id],
          "redirect_uri" => config[:redirect_uri],
          "response_type" => "code",
          "response_mode" => "form_post",
          "scope" => "email",
          "state" => state,
          "nonce" => nonce
        })

      {:ok, "https://appleid.apple.com/auth/authorize?" <> query}
    else
      {:error, reason} ->
        {:error, reason}

      _ ->
        {:error,
         if(enabled?(), do: :invalid_apple_browser_request, else: :apple_browser_disabled)}
    end
  end

  def complete(params, server \\ __MODULE__) do
    with true <- enabled?(),
         state when is_binary(state) and byte_size(state) == 43 <- params["state"],
         {:ok, flow} <- GenServer.call(cache(server), {:take_state, hash(state)}) do
      result =
        with nil <- params["error"],
             {:ok, tokens} <- AppleCodeExchange.exchange(params["code"]),
             {:ok, claims} <- Apple.verify_browser(tokens.id_token, flow.nonce),
             claims = %{
               claims
               | revocation_credential: Cherry.Identity.AppleRevocation.credential(tokens)
             },
             {:ok, grant} <- GenServer.call(cache(server), {:grant, flow, claims}) do
          %{"code" => grant, "state" => flow.client_state}
        else
          _ -> %{"error" => "apple_sign_in_failed", "state" => flow.client_state}
        end

      {:ok, flow.redirect <> "?" <> URI.encode_query(result)}
    else
      _ -> {:error, :invalid_apple_browser_state}
    end
  end

  def redeem(grant, verifier, server \\ __MODULE__) do
    if enabled?() and valid?(grant, ~r/\A[A-Za-z0-9_-]{43}\z/) and
         valid?(verifier, ~r/\A[A-Za-z0-9._~-]{43,128}\z/) do
      GenServer.call(cache(server), {:redeem, hash(grant), challenge(verifier)})
    else
      {:error, :invalid_provider_token}
    end
  end

  defp valid?(value, regex),
    do: is_binary(value) and byte_size(value) <= 128 and Regex.match?(regex, value)

  defp hash(value), do: :crypto.hash(:sha256, value)
  defp cache(server), do: Application.get_env(:cherry, :apple_browser, [])[:server] || server
  defp challenge(value), do: value |> hash() |> Base.url_encode64(padding: false)
  defp random, do: :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)

  @impl true
  def init(opts) do
    Process.send_after(self(), :cleanup, 30_000)

    {:ok,
     %{
       entries: %{},
       rates: %{},
       clock: opts[:clock] || fn -> System.monotonic_time(:millisecond) end
     }}
  end

  @impl true
  def handle_call({:start, flow, peer}, _, data) do
    data = cleanup(data)
    now = data.clock.()
    peer = hash(:erlang.term_to_binary(peer))
    {count, until} = Map.get(data.rates, peer, {0, now + @rate_window})

    cond do
      count >= @rate_limit or map_size(data.entries) >= @capacity or
          map_size(data.rates) >= @capacity ->
        {:reply, {:error, :apple_browser_rate_limited}, data}

      true ->
        state = random()
        entry = Map.merge(flow, %{type: :flow, expires: now + @flow_ttl})

        data = %{
          data
          | entries: Map.put(data.entries, hash(state), entry),
            rates: Map.put(data.rates, peer, {count + 1, until})
        }

        {:reply, {:ok, state}, data}
    end
  end

  def handle_call({:take_state, key}, _, data) do
    data = cleanup(data)
    {entry, entries} = Map.pop(data.entries, key)

    case entry do
      %{type: :flow} -> {:reply, {:ok, entry}, %{data | entries: entries}}
      _ -> {:reply, {:error, :invalid_apple_browser_state}, data}
    end
  end

  def handle_call({:grant, flow, claims}, _, data) do
    data = cleanup(data)

    if map_size(data.entries) < @capacity and data.clock.() < flow.expires do
      grant = random()

      entry = %{
        type: :grant,
        challenge: flow.challenge,
        claims: claims,
        expires: data.clock.() + @grant_ttl
      }

      {:reply, {:ok, grant}, %{data | entries: Map.put(data.entries, hash(grant), entry)}}
    else
      {:reply, {:error, :apple_browser_rate_limited}, data}
    end
  end

  def handle_call({:redeem, key, challenge}, _, data) do
    data = cleanup(data)

    case Map.get(data.entries, key) do
      %{type: :grant, challenge: expected, claims: claims} ->
        if Plug.Crypto.secure_compare(challenge, expected) do
          {:reply, {:ok, claims}, %{data | entries: Map.delete(data.entries, key)}}
        else
          {:reply, {:error, :invalid_provider_token}, data}
        end

      _ ->
        {:reply, {:error, :invalid_provider_token}, data}
    end
  end

  @impl true
  def handle_info(:cleanup, data) do
    Process.send_after(self(), :cleanup, 30_000)
    {:noreply, cleanup(data)}
  end

  defp cleanup(data) do
    now = data.clock.()

    %{
      data
      | entries: Map.reject(data.entries, fn {_, entry} -> entry.expires <= now end),
        rates: Map.reject(data.rates, fn {_, {_, until}} -> until <= now end)
    }
  end
end
