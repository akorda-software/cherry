defmodule CherryWeb.BackofficeWorkbenchTest do
  use CherryWeb.ConnCase, async: false
  import Cherry.TestSupport.DatingFixtures
  import Ecto.Query
  alias Cherry.{Accounts, Casework, Dating, Repo}
  alias Cherry.Backoffice.Access
  alias Cherry.Casework.Case

  setup do
    before = Application.get_env(:cherry, :backoffice_enabled)
    Application.put_env(:cherry, :backoffice_enabled, true)

    on_exit(fn ->
      if is_nil(before),
        do: Application.delete_env(:cherry, :backoffice_enabled),
        else: Application.put_env(:cherry, :backoffice_enabled, before)
    end)

    reporter = user_fixture()
    subject = user_fixture()
    other = user_fixture()

    %{
      reporter: reporter,
      subject: subject,
      a: complete_profile_fixture(reporter, %{display_name: "Rocío Reportante"}),
      b: complete_profile_fixture(subject, %{display_name: "Bruno Afectado"}),
      c: complete_profile_fixture(other, %{display_name: "Clara"}),
      moderator: provision!("moderator"),
      colleague: provision!("moderator"),
      privacy: provision!("privacy"),
      admin: provision!("admin"),
      owner: provision!("superadmin")
    }
  end

  test "home summarises the day and «Tomar el siguiente» serves the most urgent case", ctx do
    old = report!(ctx.a, ctx.b, "harassment")
    Repo.update_all(from(c in Case, where: c.id == ^old.id), set: [inserted_at: days_ago(2)])
    minor = report!(ctx.c, ctx.b, "underage")
    conn = login(ctx.moderator)

    home = conn |> https_get("/backoffice") |> html_response(200)
    assert home =~ "Para hoy" and home =~ "Tomar el siguiente" and home =~ "Posibles menores"
    assert home =~ short(minor) and home =~ short(old)
    refute home =~ ~s(href="/backoffice/team")
    refute home =~ ~s(href="/backoffice/activity")

    next = https_post(conn, "/backoffice/cases/next")
    assert redirected_to(next) == "/backoffice/cases/#{minor.id}"

    assert next |> recycle() |> https_get("/backoffice/cases/#{minor.id}") |> html_response(200) =~
             "Te has asignado el siguiente expediente de la cola."

    assert conn |> https_post("/backoffice/cases/next") |> redirected_to() ==
             "/backoffice/cases/#{old.id}"

    empty = https_post(conn, "/backoffice/cases/next")
    assert redirected_to(empty) == "/backoffice"

    assert empty |> recycle() |> https_get("/backoffice") |> html_response(200) =~
             "No quedan expedientes sin asignar en tus áreas."
  end

  test "queue filters by kind, owner and category and finds cases by reference", ctx do
    report = report!(ctx.a, ctx.b, "harassment")
    minor = report!(ctx.c, ctx.b, "underage")

    {:ok, complaint} =
      Casework.submit(ctx.reporter, %{
        "kind" => "complaint",
        "category" => "service",
        "statement" => "No me llegan las notificaciones."
      })

    conn = login(ctx.admin)
    {:ok, _} = Casework.claim(ctx.admin, report.id)

    page = conn |> https_get("/backoffice/cases?kind=complaint") |> html_response(200)
    assert page =~ short(complaint) and not (page =~ short(report))

    page = conn |> https_get("/backoffice/cases?category=underage") |> html_response(200)
    assert page =~ short(minor) and not (page =~ short(complaint))
    assert page =~ "Posible menor"

    page = conn |> https_get("/backoffice/cases?owner=me") |> html_response(200)
    assert page =~ short(report) and not (page =~ short(minor))

    assert conn |> https_get("/backoffice/cases?q=#{report.id}") |> redirected_to() ==
             "/backoffice/cases/#{report.id}"

    page = conn |> https_get("/backoffice/cases?q=#{short(minor)}") |> html_response(200)
    assert page =~ "Resultados para" and page =~ short(minor) and not (page =~ short(report))

    assert conn |> https_get("/backoffice/cases?q=xyz") |> html_response(200) =~
             "Busca por la referencia del expediente"

    page = login(ctx.privacy) |> https_get("/backoffice/cases?q=#{short(report)}")
    assert html_response(page, 200) =~ "Ningún expediente con esa referencia."
    refute html_response(page, 200) =~ ~s(href="/backoffice/cases/#{report.id}")
  end

  test "case page gives account context without the reporter; notes are private and escaped",
       ctx do
    {:ok, earlier} = Dating.Safety.report(ctx.c, ctx.b.id, "spam", "Enlaces a otra web")
    earlier = Repo.get_by!(Case, report_id: earlier.id)
    record = report!(ctx.a, ctx.b, "harassment")
    conn = login(ctx.moderator)

    page = conn |> https_get("/backoffice/cases/#{record.id}") |> html_response(200)
    assert page =~ "Cuenta afectada" and page =~ "Bruno Afectado"
    assert page =~ "Edad sin verificar" and page =~ "Cuenta activa"
    assert page =~ "Otros expedientes sobre esta cuenta" and page =~ short(earlier)
    refute page =~ "Rocío Reportante"
    refute page =~ ctx.reporter.email

    invalid = https_post(conn, "/backoffice/cases/#{record.id}/notes", %{"note" => "  "})
    assert html_response(invalid, 422) =~ "Escribe una nota de entre 3 y 2.000 caracteres."

    saved =
      https_post(conn, "/backoffice/cases/#{record.id}/notes", %{
        "note" => "<b>Comprobado</b> que no hay bloqueos previos."
      })

    assert redirected_to(saved) == "/backoffice/cases/#{record.id}#notas"
    page = saved |> recycle() |> https_get("/backoffice/cases/#{record.id}") |> html_response(200)
    assert page =~ "Nota guardada. Solo la ve el equipo."
    assert page =~ "&lt;b&gt;Comprobado&lt;/b&gt;"
    refute page =~ "<b>Comprobado</b>"

    forbidden =
      login(ctx.privacy)
      |> https_post("/backoffice/cases/#{record.id}/notes", %{"note" => "Nota fuera de área"})

    assert html_response(forbidden, 403) =~ "Esto no es de tu área"
  end

  test "suspending needs explicit confirmation and model texts are offered only to the assignee",
       ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    {:ok, _} = Casework.claim(ctx.moderator, record.id)
    conn = login(ctx.moderator)

    page =
      conn
      |> https_get("/backoffice/cases/#{record.id}?modelo=suspend")
      |> html_response(200)

    assert page =~ "[HECHOS COMPROBADOS, SIN DATOS DE QUIEN REPORTÓ]"

    refute login(ctx.colleague)
           |> https_get("/backoffice/cases/#{record.id}?modelo=suspend")
           |> html_response(200) =~ "[HECHOS COMPROBADOS"

    decision = %{
      "outcome" => "suspend",
      "response" =>
        "Hemos comprobado mensajes insistentes tras una negativa clara. Incumple las normas de convivencia.",
      "reporter_response" => "Gracias por avisarnos. Hemos revisado tu reporte y hemos actuado."
    }

    unconfirmed = https_post(conn, "/backoffice/cases/#{record.id}/resolve", decision)
    assert html_response(unconfirmed, 422) =~ "marca la casilla"
    assert html_response(unconfirmed, 422) =~ "mensajes insistentes"

    gaps =
      https_post(
        conn,
        "/backoffice/cases/#{record.id}/resolve",
        Map.merge(decision, %{
          "confirm_suspend" => "true",
          "response" => "Hemos comprobado [HECHOS COMPROBADOS]. Incumple las normas de Cherry."
        })
      )

    assert html_response(gaps, 422) =~ "Sustituye los huecos entre corchetes"
    assert Repo.get!(Case, record.id).status == "open"

    done =
      https_post(
        conn,
        "/backoffice/cases/#{record.id}/resolve",
        Map.put(decision, "confirm_suspend", "true")
      )

    assert redirected_to(done) == "/backoffice/cases/#{record.id}"
    assert Repo.get!(Accounts.User, ctx.subject.id).suspended_at

    page = done |> recycle() |> https_get("/backoffice/cases/#{record.id}") |> html_response(200)
    assert page =~ "Decisión guardada" and page =~ "Lo decidiste tú"
  end

  test "assignment controls report conflicts back on the case", ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    admin = login(ctx.admin)

    assigned =
      https_post(admin, "/backoffice/cases/#{record.id}/assign", %{
        "staff_id" => ctx.moderator.id
      })

    assert redirected_to(assigned) == "/backoffice/cases/#{record.id}"
    assert Repo.get!(Case, record.id).assigned_staff_id == ctx.moderator.id

    assert assigned
           |> recycle()
           |> https_get("/backoffice/cases/#{record.id}")
           |> html_response(200) =~
             "Expediente asignado a #{ctx.moderator.email}."

    refused =
      https_post(admin, "/backoffice/cases/#{record.id}/assign", %{
        "staff_id" => ctx.privacy.id
      })

    assert refused
           |> recycle()
           |> https_get("/backoffice/cases/#{record.id}")
           |> html_response(200) =~
             "No se puede asignar a esa persona"

    colleague = login(ctx.colleague)
    taken = https_post(colleague, "/backoffice/cases/#{record.id}/claim")
    assert redirected_to(taken) == "/backoffice/cases/#{record.id}"

    assert taken |> recycle() |> https_get("/backoffice/cases/#{record.id}") |> html_response(200) =~
             "Otra persona se ha asignado este expediente antes que tú."

    assert colleague |> https_post("/backoffice/cases/#{record.id}/release") |> response(403)

    released = https_post(login(ctx.moderator), "/backoffice/cases/#{record.id}/release")
    assert redirected_to(released) == "/backoffice/cases/#{record.id}"
    assert Repo.get!(Case, record.id).assigned_staff_id == nil
  end

  test "measures, activity and team pages follow the role", ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    {:ok, _} = Casework.claim(ctx.moderator, record.id)
    {:ok, _} = Casework.resolve(ctx.moderator, record.id, resolution("suspend"))

    page = login(ctx.colleague) |> https_get("/backoffice/measures") |> html_response(200)
    assert page =~ "Medidas vigentes" and page =~ "Bruno Afectado"
    assert login(ctx.privacy) |> https_get("/backoffice/measures") |> response(403)

    assert login(ctx.admin) |> https_get("/backoffice/activity") |> response(403)
    owner = login(ctx.owner)
    page = owner |> https_get("/backoffice/activity") |> html_response(200)
    assert page =~ "Resolución" and page =~ ctx.moderator.email

    page =
      owner
      |> https_get("/backoffice/activity?group=decisions&person=#{ctx.moderator.id}")
      |> html_response(200)

    assert page =~ "Resolución" and page =~ short(record)
    refute page =~ "Inicio de sesión"

    team = owner |> https_get("/backoffice/team") |> html_response(200)
    assert team =~ "Equipo y permisos" and team =~ "Entra con código de consola"
    assert team =~ "Último acceso" and team =~ "Nunca ha entrado"
    assert team =~ "0 expedientes abiertos asignados"
    assert team =~ "Es tu cuenta"
    refute team =~ ~s(action="/backoffice/team/#{ctx.owner.id}")
    assert team =~ ~s(action="/backoffice/team/#{ctx.moderator.id}/reset-access")
  end

  test "closing my other sessions keeps this one", ctx do
    first = login(ctx.moderator)
    second = login(ctx.moderator)

    page = first |> https_get("/backoffice/account") |> html_response(200)
    assert page =~ "2 sesiones" and page =~ "Cerrar mis otras sesiones"

    closed = https_post(first, "/backoffice/account/sessions")
    assert redirected_to(closed) == "/backoffice/account"

    assert closed |> recycle() |> https_get("/backoffice/account") |> html_response(200) =~
             "Hemos cerrado tu otra sesión. Esta sigue abierta."

    assert second |> https_get("/backoffice") |> redirected_to() == "/backoffice/login"
    assert first |> https_get("/backoffice") |> html_response(200) =~ "Para hoy"
  end

  test "missing and foreign cases render the error page inside the panel", ctx do
    record = report!(ctx.a, ctx.b, "harassment")

    missing =
      login(ctx.moderator) |> https_get("/backoffice/cases/#{Ecto.UUID.generate()}")

    page = html_response(missing, 404)
    assert page =~ "No encontramos ese expediente" and page =~ "Ir a expedientes"
    refute page =~ "<script"

    assert login(ctx.privacy) |> https_get("/backoffice/cases/#{record.id}") |> html_response(403) =~
             "Esto no es de tu área"
  end

  defp provision!(role) do
    {:ok, staff} =
      Access.provision("#{role}#{System.unique_integer([:positive])}@example.test", role)

    staff
  end

  defp login(staff) do
    {:ok, code} = Access.issue_login(staff.email)
    conn = https_post(%{build_conn() | scheme: :https}, "/backoffice/login", %{"code" => code})
    assert redirected_to(conn) == "/backoffice"
    conn
  end

  defp report!(from, to, reason) do
    {:ok, report} = Dating.Safety.report(from, to.id, reason, "Detalles solo para el equipo")
    Repo.get_by!(Case, report_id: report.id)
  end

  defp short(%Case{id: id}), do: String.slice(id, 0, 8)

  defp days_ago(days),
    do: DateTime.utc_now() |> DateTime.add(-days * 86_400) |> DateTime.truncate(:second)

  defp resolution(outcome),
    do: %{
      "outcome" => outcome,
      "response" => "Decisión motivada para la persona afectada. Puedes recurrir en tu buzón.",
      "reporter_response" => "Hemos revisado tu reporte y comunicado el resultado necesario."
    }

  defp https_get(conn, path), do: get(conn, "https://www.example.com" <> path)

  defp https_post(conn, path, params \\ %{}),
    do: post(conn, "https://www.example.com" <> path, params)
end
