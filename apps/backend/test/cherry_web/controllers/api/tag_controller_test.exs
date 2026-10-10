defmodule CherryWeb.Controllers.Api.TagControllerTest do
  use CherryWeb.ConnCase, async: false

  alias Cherry.Accounts
  alias Cherry.Dating
  alias Cherry.Sessions

  setup do
    {:ok, user} = Accounts.create_user(%{email: "tags@example.com", display_name: "Tags"})

    {:ok, issued} =
      Sessions.issue_session(user, %{installation_id: "i", platform: "ios", device_name: "D"})

    authed_conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    {:ok, _} =
      Dating.create_tag(%{
        slug: "music",
        label: "Música",
        category: "interests",
        sort_order: 1,
        emoji: "🎵"
      })

    {:ok, _} =
      Dating.create_tag(%{
        slug: "smoker",
        label: "Fumador/a",
        category: "lifestyle",
        sort_order: 2
      })

    {:ok, _} =
      Dating.create_tag(%{
        slug: "legacy",
        label: "Legacy",
        category: "interests",
        sort_order: 3,
        is_active: false
      })

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
      assert first["emoji"] == "🎵"

      assert Enum.find(tags, &(&1["slug"] == "smoker"))["emoji"] == nil
    end

    test "returns the catalog in sort order", %{authed_conn: conn} do
      {:ok, _} =
        Dating.create_tag(%{slug: "anime", label: "Anime", category: "interests", sort_order: 0})

      assert %{"tags" => tags} = conn |> get("/api/tags") |> json_response(200)
      assert Enum.map(tags, & &1["slug"]) == ["anime", "music", "smoker"]
    end
  end
end
