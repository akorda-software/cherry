defmodule SnackWeb.Controllers.Api.ProfilePhotosTagsTest do
  @moduledoc "Photo reordering/deletion and tag validation on /api/me/*."
  use SnackWeb.ConnCase, async: false

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Sessions

  setup do
    {:ok, user} = Accounts.create_user(%{email: "photos-tags@example.com", display_name: "PT"})

    {:ok, profile} =
      Dating.create_profile(%{
        user_id: user.id,
        display_name: "Marta",
        birth_date: ~D[1992-06-10],
        gender: "woman",
        what_i_am_looking_for: "go_with_the_flow",
        bio: "Colecciono plantas que sobreviven de milagro y planes improvisados."
      })

    {:ok, issued} =
      Sessions.issue_session(user, %{installation_id: "pt", platform: "ios", device_name: "D"})

    conn = put_req_header(build_conn(), "authorization", "Bearer #{issued.session.access_token}")

    %{conn: conn, profile: profile}
  end

  describe "PUT /api/me/photos/order" do
    setup %{profile: profile} do
      photos =
        for position <- 1..3 do
          {:ok, photo} =
            Dating.create_photo(%{
              profile_id: profile.id,
              storage_key: "profiles/#{profile.id}/#{position}.jpg",
              url: "/uploads/profiles/#{profile.id}/#{position}.jpg",
              position: position,
              is_active: true
            })

          photo
        end

      %{photos: photos}
    end

    test "reorders every active photo and returns absolute URLs", %{
      conn: conn,
      photos: [p1, p2, p3]
    } do
      assert %{"photos" => photos} =
               conn
               |> put("/api/me/photos/order", %{"photoIds" => [p3.id, p1.id, p2.id]})
               |> json_response(200)

      assert Enum.map(photos, &{&1["id"], &1["position"]}) == [
               {p3.id, 1},
               {p1.id, 2},
               {p2.id, 3}
             ]

      assert Enum.all?(photos, &String.starts_with?(&1["url"], "http://www.example.com/uploads/"))
      assert Enum.all?(photos, &(&1["isActive"] == true))
    end

    test "keeps positions of photos whose place does not change", %{
      conn: conn,
      photos: [p1, p2, p3]
    } do
      assert %{"photos" => photos} =
               conn
               |> put("/api/me/photos/order", %{"photoIds" => [p1.id, p3.id, p2.id]})
               |> json_response(200)

      assert Enum.map(photos, &{&1["id"], &1["position"]}) == [
               {p1.id, 1},
               {p3.id, 2},
               {p2.id, 3}
             ]

      assert Enum.map(Dating.list_photos(p1.profile_id), & &1.position) == [1, 2, 3]
    end

    test "rejects partial, duplicated, foreign or malformed lists", %{
      conn: conn,
      photos: [p1, p2, p3]
    } do
      for ids <- [
            [p1.id, p2.id],
            [p1.id, p1.id, p2.id],
            [p1.id, p2.id, p3.id, Ecto.UUID.generate()],
            [p1.id, p2.id, "not-a-uuid"],
            "nope",
            nil
          ] do
        assert %{"error" => "invalid_photo_ids"} =
                 conn
                 |> put("/api/me/photos/order", %{"photoIds" => ids})
                 |> json_response(422)
      end

      assert Enum.map(Dating.list_photos(p1.profile_id), & &1.id) == [p1.id, p2.id, p3.id]
    end
  end

  describe "DELETE /api/me/photos/:id" do
    test "soft-deletes an own photo and answers {ok: true}", %{conn: conn, profile: profile} do
      {:ok, photo} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "profiles/#{profile.id}/x.jpg",
          url: "/uploads/profiles/#{profile.id}/x.jpg",
          position: 1
        })

      assert conn |> delete("/api/me/photos/#{photo.id}") |> json_response(200) == %{"ok" => true}
      assert Dating.list_photos(profile.id) == []
    end

    test "answers 404 for unknown or malformed IDs", %{conn: conn} do
      assert %{"error" => "photo_not_found"} =
               conn |> delete("/api/me/photos/#{Ecto.UUID.generate()}") |> json_response(404)

      assert %{"error" => "photo_not_found"} =
               conn |> delete("/api/me/photos/nope") |> json_response(404)
    end
  end

  describe "PUT /api/me/tags and /api/me/blocked-tags" do
    setup do
      tags =
        for {slug, emoji, order} <- [{"music", "🎵", 1}, {"cinema", "🎬", 2}, {"smoker", "🚬", 3}] do
          {:ok, tag} =
            Dating.create_tag(%{
              slug: slug,
              label: String.capitalize(slug),
              category: "interests",
              sort_order: order,
              emoji: emoji
            })

          tag
        end

      {:ok, inactive} =
        Dating.create_tag(%{
          slug: "legacy",
          label: "Legacy",
          category: "interests",
          is_active: false
        })

      %{tags: tags, inactive: inactive}
    end

    test "returns the full tag shape with emoji and sortOrder", %{conn: conn, tags: [music | _]} do
      assert %{"tags" => [tag]} =
               conn |> put("/api/me/tags", %{"tag_ids" => [music.id]}) |> json_response(200)

      assert tag == %{
               "id" => music.id,
               "slug" => "music",
               "label" => "Music",
               "category" => "interests",
               "sortOrder" => 1,
               "emoji" => "🎵"
             }

      assert %{"tags" => [%{"emoji" => "🎵"}]} = conn |> get("/api/me/tags") |> json_response(200)
    end

    test "rejects unknown, malformed and inactive IDs with invalid_tags", %{
      conn: conn,
      tags: [music | _],
      inactive: inactive
    } do
      unknown = Ecto.UUID.generate()

      for {path, ids, offending} <- [
            {"/api/me/tags", [music.id, unknown], [unknown]},
            {"/api/me/tags", [music.id, inactive.id], [inactive.id]},
            {"/api/me/tags", ["nope"], ["nope"]},
            {"/api/me/blocked-tags", [unknown], [unknown]},
            {"/api/me/blocked-tags", [inactive.id], [inactive.id]}
          ] do
        assert %{"error" => "invalid_tags", "tagIds" => ^offending} =
                 conn |> put(path, %{"tag_ids" => ids}) |> json_response(422)
      end

      assert %{"error" => "invalid_tags"} =
               conn |> put("/api/me/tags", %{"tag_ids" => "music"}) |> json_response(422)

      assert %{"tags" => []} = conn |> get("/api/me/tags") |> json_response(200)
    end

    test "rejects a tag that would be both positive and blocked", %{
      conn: conn,
      tags: [music, cinema, smoker]
    } do
      conn |> put("/api/me/blocked-tags", %{"tag_ids" => [smoker.id]}) |> json_response(200)

      assert %{"error" => "tag_conflict", "tagIds" => [smoker_id]} =
               conn
               |> put("/api/me/tags", %{"tag_ids" => [music.id, smoker.id]})
               |> json_response(422)

      assert smoker_id == smoker.id

      conn |> put("/api/me/tags", %{"tag_ids" => [music.id, cinema.id]}) |> json_response(200)

      assert %{"error" => "tag_conflict", "tagIds" => [cinema_id]} =
               conn
               |> put("/api/me/blocked-tags", %{"tag_ids" => [smoker.id, cinema.id]})
               |> json_response(422)

      assert cinema_id == cinema.id

      assert %{"blockedTags" => [%{"slug" => "smoker"}]} =
               conn |> get("/api/me/blocked-tags") |> json_response(200)
    end

    test "keeps the 8/5 limits and ignores duplicates", %{conn: conn, tags: [music | _]} do
      many =
        for i <- 1..9 do
          {:ok, tag} = Dating.create_tag(%{slug: "t#{i}", label: "T#{i}", category: "values"})
          tag.id
        end

      assert %{"error" => "too_many_tags"} =
               conn |> put("/api/me/tags", %{"tag_ids" => many}) |> json_response(422)

      assert %{"error" => "too_many_blocked_tags"} =
               conn
               |> put("/api/me/blocked-tags", %{"tag_ids" => Enum.take(many, 6)})
               |> json_response(422)

      assert %{"tags" => tags} =
               conn
               |> put("/api/me/tags", %{"tag_ids" => Enum.take(many, 7) ++ [music.id, music.id]})
               |> json_response(200)

      assert length(tags) == 8

      assert %{"blockedTags" => blocked} =
               conn
               |> put("/api/me/blocked-tags", %{"tag_ids" => Enum.slice(many, 7, 2)})
               |> json_response(200)

      assert length(blocked) == 2
    end
  end
end
