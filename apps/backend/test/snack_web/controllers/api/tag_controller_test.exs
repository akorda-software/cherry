defmodule SnackWeb.Controllers.Api.TagControllerTest do
  use SnackWeb.ConnCase, async: false

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Sessions

  setup do
    {:ok, user} = Accounts.create_user(%{email: "tags@example.com", display_name: "Tags"})
    {:ok, issued} = Sessions.issue_session(user, %{installation_id: "i", platform: "ios", device_name: "D"})

    authed_conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    {:ok, _} =
      Dating.create_tag(%{slug: "music", label: "Música", category: "interests", sort_order: 1})

    {:ok, _} =
      Dating.create_tag(%{slug: "smoker", label: "Fumador/a", category: "lifestyle", sort_order: 2})

    {:ok, _} =
      Dating.create_tag(%{slug: "legacy", label: "Legacy", category: "interests", sort_order: 3, is_active: false})

    %{authed_conn: authed_conn}
  end

  describe "GET /api/tags" do
    test "returns only active tags", %{authed_conn: conn} do
      conn = get(conn, "/api/tags")
      assert %{"tags" => tags} = json_response(conn, 200)

      slugs = Enum.map(tags, & &1["slug"]) |> Enum.sort()
      assert slugs == ["music", "smoker"]

      first = Enum.find(tags, &(&1["slug"] == "music"))
      assert first["label"] == "Música"
      assert first["category"] == "interests"
      assert first["sortOrder"] == 1
    end
  end
end
