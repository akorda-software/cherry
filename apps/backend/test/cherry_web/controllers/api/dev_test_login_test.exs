defmodule CherryWeb.Controllers.Api.DevTestLoginTest do
  use CherryWeb.ConnCase, async: false

  import Ecto.Query

  alias Cherry.Accounts
  alias Cherry.Accounts.User
  alias Cherry.Repo
  alias Cherry.Sessions.Device

  setup do
    previous = Application.get_env(:cherry, :enable_dev_test_login)
    Application.put_env(:cherry, :enable_dev_test_login, true)
    on_exit(fn -> Application.put_env(:cherry, :enable_dev_test_login, previous) end)
    :ok
  end

  test "is disabled unless the flag is on", %{conn: conn} do
    Application.put_env(:cherry, :enable_dev_test_login, false)

    assert %{"error" => "dev_test_login_disabled"} =
             conn |> post("/api/auth/dev/test-login", %{}) |> json_response(404)
  end

  test "an empty body logs in as the shared test user (what the mobile sends)", %{conn: conn} do
    assert %{
             "accessToken" => access_token,
             "refreshToken" => _refresh,
             "user" => %{"email" => "test@cherry.app", "displayName" => "Test User", "id" => id}
           } = conn |> post("/api/auth/dev/test-login", %{}) |> json_response(201)

    assert access_token != ""

    assert %{"user" => %{"id" => ^id}} =
             build_conn() |> post("/api/auth/dev/test-login") |> json_response(201)

    assert Repo.get_by!(Device, user_id: id).installation_id == "dev-test-device"
  end

  test "logs in as a given persona, creating it on first use", %{conn: conn} do
    assert %{"user" => %{"id" => id, "email" => "lucia@cherry.dev", "displayName" => "Lucía"}} =
             conn
             |> post("/api/auth/dev/test-login", %{
               "email" => "Lucia@Cherry.dev",
               "displayName" => "Lucía"
             })
             |> json_response(201)

    # Same persona again (any casing), display name only applies on creation.
    assert %{"user" => %{"id" => ^id, "displayName" => "Lucía"}} =
             build_conn()
             |> post("/api/auth/dev/test-login", %{
               "email" => "lucia@cherry.dev",
               "displayName" => "X"
             })
             |> json_response(201)

    assert %{"user" => %{"email" => "pablo@cherry.dev", "displayName" => "Pablo"}} =
             build_conn()
             |> post("/api/auth/dev/test-login", %{"email" => "pablo@cherry.dev"})
             |> json_response(201)

    assert Repo.aggregate(User, :count, :id) == 2
  end

  test "reuses an existing account and accepts full or partial devices", %{conn: conn} do
    {:ok, existing} = Accounts.create_user(%{email: "demo@cherry.dev", display_name: "Demo"})

    assert %{"user" => %{"id" => id}} =
             conn
             |> post("/api/auth/dev/test-login", %{
               "email" => "demo@cherry.dev",
               "device" => %{
                 "installationId" => "pixel-install",
                 "platform" => "android",
                 "deviceName" => "Pixel 9"
               }
             })
             |> json_response(201)

    assert id == existing.id

    assert build_conn()
           |> post("/api/auth/dev/test-login", %{
             "email" => "demo@cherry.dev",
             "device" => %{"installationId" => "web-install"}
           })
           |> json_response(201)

    devices = Repo.all(from(d in Device, where: d.user_id == ^id, order_by: d.installation_id))

    assert Enum.map(devices, &{&1.installation_id, &1.platform, &1.device_name}) == [
             {"pixel-install", "android", "Pixel 9"},
             {"web-install", "android", "Dev Test Device"}
           ]
  end

  test "rejects invalid emails and allows a fresh signup after erasure", %{conn: conn} do
    assert %{"error" => "invalid_email"} =
             conn
             |> post("/api/auth/dev/test-login", %{"email" => "not-an-email"})
             |> json_response(422)

    assert %{"error" => "invalid_email"} =
             build_conn()
             |> post("/api/auth/dev/test-login", %{"email" => 42})
             |> json_response(422)

    {:ok, user} = Accounts.create_user(%{email: "gone@cherry.dev", display_name: "Gone"})
    {:ok, :deleted} = Accounts.delete_account(user)

    assert %{"user" => %{"id" => new_id}} =
             build_conn()
             |> post("/api/auth/dev/test-login", %{"email" => "gone@cherry.dev"})
             |> json_response(201)

    assert new_id != user.id
    refute Repo.get(Cherry.Accounts.User, user.id)
  end
end
