defmodule CherryWeb.Controllers.Api.PhotoAccessControllerTest do
  use CherryWeb.ConnCase, async: false
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.{Dating, Repo}

  setup do
    previous = Application.get_env(:cherry, Cherry.Storage.R2)

    Application.put_env(:cherry, Cherry.Storage.R2,
      account_id: "test",
      bucket_name: "private",
      access_key_id: "access",
      secret_access_key: "secret"
    )

    on_exit(fn -> Application.put_env(:cherry, Cherry.Storage.R2, previous) end)
    user = user_fixture()
    viewer = complete_profile_fixture(user)
    other = complete_profile_fixture(user_fixture())
    [first | _] = Dating.list_photos(other.id)
    {:ok, photo} = Repo.update(Ecto.Changeset.change(first, storage_key: "photos/other.jpg"))
    %{user: user, viewer: viewer, other: other, photo: photo, conn: authed_conn_for_user(user)}
  end

  test "a known key alone cannot bypass authentication", ctx do
    assert build_conn()
           |> post("/api/photos/read-url", %{storageKey: ctx.photo.storage_key})
           |> response(401)
  end

  test "renewal rechecks current visibility, blocks and deletion", ctx do
    params = %{storageKey: ctx.photo.storage_key}
    response_conn = post(ctx.conn, "/api/photos/read-url", params)
    assert %{"url" => url} = json_response(response_conn, 200)
    assert url =~ "X-Amz-Expires=300"
    assert get_resp_header(response_conn, "cache-control") == ["private, no-store"]
    {:ok, _} = Dating.Safety.block(ctx.viewer, ctx.other.id)
    assert ctx.conn |> post("/api/photos/read-url", params) |> response(404)
    Repo.update_all(Dating.ProfilePhoto, set: [is_active: false])
    assert ctx.conn |> post("/api/photos/read-url", params) |> response(404)
  end

  test "own photos remain accessible during onboarding/suspension; others do not", ctx do
    own = hd(Dating.list_photos(ctx.viewer.id))
    Repo.update!(Ecto.Changeset.change(own, storage_key: "photos/own.jpg"))

    Repo.update!(
      Ecto.Changeset.change(ctx.user,
        suspended_at: DateTime.utc_now() |> DateTime.truncate(:second)
      )
    )

    assert ctx.conn
           |> post("/api/photos/read-url", %{storageKey: "photos/own.jpg"})
           |> response(200)

    assert ctx.conn
           |> post("/api/photos/read-url", %{storageKey: ctx.photo.storage_key})
           |> response(404)
  end
end
