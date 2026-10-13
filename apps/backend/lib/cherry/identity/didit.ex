defmodule Cherry.Identity.Didit do
  @moduledoc """
  HTTP client of Didit (https://didit.me), the external age verification
  method: the user takes a selfie and photographs an identity document in
  Didit's hosted flow and the backend reads the decision (API v3).

  Config `:cherry, :didit`: `api_key` (`DIDIT_API_KEY`), `workflow_id`
  (`DIDIT_WORKFLOW_ID`), `base_url` and `req_options` (tests plug `Req.Test`).

  Nothing here is logged except HTTP status codes: decisions carry the
  holder's name, birth date, document number and photos. `get_decision/1`
  returns only the fields the age check needs and the raw response is dropped
  when the call returns.
  """

  require Logger

  @receive_timeout 15_000
  @connect_timeout 5_000

  @type session :: %{session_id: String.t(), url: String.t()}

  @type id_verification :: %{
          status: String.t() | nil,
          document_type: String.t() | nil,
          document_number: String.t() | nil,
          personal_number: String.t() | nil,
          date_of_birth: String.t() | nil,
          issuing_state: String.t() | nil,
          expiration_date: String.t() | nil
        }

  @type decision :: %{
          status: String.t() | nil,
          vendor_data: String.t() | nil,
          environment: String.t() | nil,
          id_verifications: [id_verification()]
        }

  @doc "True when an API key and a workflow are configured."
  def configured?, do: present?(config()[:api_key]) and present?(config()[:workflow_id])

  @doc """
  Creates a verification session for the user (`vendor_data`). Didit returns
  the same session while it has not started. `callback` is where Didit's page
  sends the user when the flow ends (`nil`: none).
  """
  @spec create_session(String.t(), String.t() | nil) ::
          {:ok, session()} | {:error, :provider_error}
  def create_session(user_id, callback) do
    body =
      %{
        workflow_id: config()[:workflow_id],
        vendor_data: user_id,
        callback_method: "both",
        language: "es"
      }
      |> then(fn body -> if callback, do: Map.put(body, :callback, callback), else: body end)

    case request(:post, "/v3/session/", json: body) do
      {:ok, %{status: status, body: %{"session_id" => id, "url" => url}}}
      when status in [200, 201] and is_binary(id) and is_binary(url) ->
        {:ok, %{session_id: id, url: url}}

      other ->
        failure("create session", other)
    end
  end

  @doc "Decision of a session; `{:error, :not_found}` when Didit does not know it."
  @spec get_decision(String.t()) ::
          {:ok, decision()} | {:error, :not_found | :provider_error}
  def get_decision(session_id) do
    case request(:get, "/v3/session/#{session_id}/decision/", []) do
      {:ok, %{status: 200, body: %{} = body}} ->
        {:ok, decision(body)}

      {:ok, %{status: 404}} ->
        {:error, :not_found}

      other ->
        failure("get decision", other)
    end
  end

  @doc """
  Erases the session at Didit (`privacy_erasure`: photos, selfie and extracted
  data). `{:error, status}` when it fails; 503 means "retry later".
  """
  @spec delete_session(String.t()) :: :ok | {:error, pos_integer() | :transport}
  def delete_session(session_id) do
    case request(:delete, "/v3/session/#{session_id}/delete/",
           json: %{deletion_instruction: "privacy_erasure"}
         ) do
      {:ok, %{status: status}} when status in 200..299 -> :ok
      {:ok, %{status: status}} -> {:error, status}
      {:error, _} -> {:error, :transport}
    end
  end

  defp decision(body) do
    %{
      status: string(body["status"]),
      vendor_data: string(body["vendor_data"]),
      environment: string(body["environment"]),
      id_verifications:
        case body["id_verifications"] do
          list when is_list(list) -> for %{} = idv <- list, do: id_verification(idv)
          _ -> []
        end
    }
  end

  defp id_verification(idv) do
    %{
      status: string(idv["status"]),
      document_type: string(idv["document_type"]),
      document_number: string(idv["document_number"]),
      personal_number: string(idv["personal_number"]),
      date_of_birth: string(idv["date_of_birth"]),
      issuing_state: string(idv["issuing_state"]),
      expiration_date: string(idv["expiration_date"])
    }
  end

  defp string(value) when is_binary(value), do: value
  defp string(_value), do: nil

  defp failure(action, {:ok, %{status: status}}) do
    Logger.warning("didit: #{action} failed (HTTP #{status})")
    {:error, :provider_error}
  end

  defp failure(action, {:error, reason}) do
    Logger.warning("didit: #{action} failed (#{reason})")
    {:error, :provider_error}
  end

  # Transport errors and crashes are reduced to a tag: their messages could
  # echo a request or response body.
  defp request(method, path, options) do
    [
      method: method,
      url: path,
      base_url: config()[:base_url] || "https://verification.didit.me",
      headers: [{"x-api-key", config()[:api_key] || ""}, {"accept", "application/json"}],
      receive_timeout: @receive_timeout,
      connect_options: [timeout: @connect_timeout],
      retry: false
    ]
    |> Keyword.merge(options)
    |> Keyword.merge(config()[:req_options] || [])
    |> Req.request()
    |> case do
      {:ok, %Req.Response{} = response} -> {:ok, response}
      {:error, exception} -> {:error, "transport error #{inspect(exception.__struct__)}"}
    end
  rescue
    exception -> {:error, "crashed with #{inspect(exception.__struct__)}"}
  end

  defp present?(value), do: is_binary(value) and value != ""

  defp config, do: Application.get_env(:cherry, :didit, [])
end
