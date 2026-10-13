defmodule Cherry.TestSupport.DiditStub do
  @moduledoc """
  Fake Didit API for tests (`Req.Test`, no network). Decisions are built from
  made-up documents only.

  `stub/1` serves session creation, decisions and deletion. Every request is
  sent to the test process as `{:didit, method, path, body}`.
  """

  @session_id "11111111-2222-4333-8444-555555555555"

  def session_id, do: @session_id

  @doc """
  Options: `:decision` (map served by GET .../decision/, or `:not_found`),
  `:create_status` (default 201), `:delete_status` (default 200).
  """
  def stub(opts \\ []) do
    owner = self()

    Req.Test.stub(Cherry.Identity.Didit, fn conn ->
      {:ok, raw, conn} = Plug.Conn.read_body(conn)
      body = if raw == "", do: nil, else: Jason.decode!(raw)
      send(owner, {:didit, conn.method, conn.request_path, body})
      respond(conn, opts, body)
    end)
  end

  defp respond(%{method: "POST", request_path: "/v3/session/"} = conn, opts, body) do
    conn
    |> Plug.Conn.put_status(Keyword.get(opts, :create_status, 201))
    |> Req.Test.json(%{
      "session_id" => @session_id,
      "session_number" => 1,
      "url" => "https://verify.didit.test/session/fake-token",
      "status" => "Not Started",
      "vendor_data" => body["vendor_data"],
      "workflow_id" => body["workflow_id"]
    })
  end

  defp respond(%{method: "GET"} = conn, opts, _body) do
    case Keyword.get(opts, :decision, :not_found) do
      :not_found ->
        conn |> Plug.Conn.put_status(404) |> Req.Test.json(%{"detail" => "Not found."})

      {:status, status} ->
        conn |> Plug.Conn.put_status(status) |> Req.Test.json(%{})

      decision ->
        Req.Test.json(conn, decision)
    end
  end

  defp respond(%{method: "DELETE"} = conn, opts, _body) do
    conn
    |> Plug.Conn.put_status(Keyword.get(opts, :delete_status, 200))
    |> Req.Test.json(%{})
  end

  @doc "A decision for `user_id` with one made-up document (overrides in `idv`)."
  def decision(user_id, status, idv \\ %{}, extra \\ %{}) do
    Map.merge(
      %{
        "session_id" => @session_id,
        "session_number" => 1,
        "status" => status,
        "vendor_data" => user_id,
        "environment" => "sandbox",
        "id_verifications" => [
          Map.merge(
            %{
              "status" => status,
              "document_type" => "Identity Card",
              "document_number" => "ZZZ000001",
              "personal_number" => "99999999R",
              "first_name" => "PRUEBA",
              "last_name" => "FICTICIA",
              "full_name" => "PRUEBA FICTICIA",
              "date_of_birth" => "1990-01-01",
              "age" => 36,
              "issuing_state" => "ESP",
              "issuing_state_name" => "Spain",
              "expiration_date" => "2031-01-01",
              "front_image" => "https://didit.test/fake-front.jpg",
              "portrait_image" => "https://didit.test/fake-portrait.jpg"
            },
            idv
          )
        ]
      },
      extra
    )
  end
end
