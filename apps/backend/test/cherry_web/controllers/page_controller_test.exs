defmodule CherryWeb.PageControllerTest do
  use CherryWeb.ConnCase

  test "GET /", %{conn: conn} do
    conn = get(conn, ~p"/")
    html = html_response(conn, 200)
    assert html =~ "La app para conocer gente que es de"
    assert html =~ "/eliminar-cuenta"
    assert html =~ "textos legales son provisionales"
    refute html =~ "Phoenix Framework"
    refute html =~ "<script"
  end

  test "the landing says what the age check keeps, fingerprint included", %{conn: conn} do
    html = conn |> get(~p"/") |> html_response(200)

    assert html =~ "No guardamos tu documento."
    assert html =~ "Solo guardamos que eres mayor de edad, cómo y cuándo lo comprobaste"
    assert html =~ "una huella cifrada para que cada documento abra una sola cuenta"
  end

  test "every legal and help page is public, explicit about drafts and has no third party scripts" do
    for path <-
          ~w(/privacidad /condiciones /normas /seguridad-infantil /transparencia /contacto /eliminar-cuenta /aviso-legal /cookies) do
      conn = get(build_conn(), path)
      html = html_response(conn, 200)
      assert html =~ "textos legales son provisionales"
      assert get_resp_header(conn, "referrer-policy") == ["no-referrer"]
      assert get_resp_header(conn, "cache-control") == ["no-cache, no-transform"]
      assert [csp] = get_resp_header(conn, "content-security-policy")
      assert csp =~ "default-src 'none'"
      refute html =~ "<script"
      refute html =~ "googleapis.com"
    end
  end

  test "public deletion makes missing contact and backup limits visible" do
    html = get(build_conn(), "/eliminar-cuenta") |> html_response(200)
    assert html =~ "Esta vía no está operativa"
    assert html =~ "No prometemos destrucción instantánea"
    assert html =~ "mismo DNI"
    refute html =~ "<form"
  end
end
