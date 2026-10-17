defmodule CherryWeb.PublicContactTest do
  use CherryWeb.ConnCase, async: false

  test "configured contact accepts requests without sending the user back to the app" do
    previous = Application.get_env(:cherry, :instance)
    on_exit(fn -> Application.put_env(:cherry, :instance, previous) end)

    Application.put_env(:cherry, :instance,
      operator: "<script>not markup</script>",
      contact_email: "privacy@example.test"
    )

    html = get(build_conn(), "/eliminar-cuenta") |> html_response(200)
    assert html =~ "mailto:privacy@example.test"
    assert html =~ "No necesitas reinstalar la app"
    assert html =~ "El equipo verificará la solicitud"
    refute html =~ "Esta vía no está operativa"
    html = get(build_conn(), "/contacto") |> html_response(200)
    assert html =~ "&lt;script&gt;not markup&lt;/script&gt;"
    refute html =~ "<script>not markup</script>"
  end
end
