defmodule CherryWeb.HealthControllerTest do
  use CherryWeb.ConnCase, async: true

  describe "GET /healthz" do
    test "devuelve ok y versión sin depender de la base de datos", %{conn: conn} do
      conn = get(conn, "/healthz")

      assert %{"status" => "ok", "version" => version} = json_response(conn, 200)
      assert is_binary(version)
    end
  end

  describe "GET /readyz" do
    test "devuelve ready cuando la base de datos responde", %{conn: conn} do
      conn = get(conn, "/readyz")

      assert %{"status" => "ready"} = json_response(conn, 200)
    end
  end
end
