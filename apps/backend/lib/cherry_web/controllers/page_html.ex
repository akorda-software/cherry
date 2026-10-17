defmodule CherryWeb.PageHTML do
  @moduledoc """
  This module contains pages rendered by PageController.

  See the `page_html` directory for all templates available.
  """
  use CherryWeb, :html

  embed_templates("page_html/*")

  attr(:title, :string, required: true)
  attr(:description, :string, required: true)
  attr(:instance, :map, required: true)
  slot(:inner_block, required: true)

  def site(assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={@description} />
        <title>{@title} · {@instance.name}</title>
        <link rel="stylesheet" href={~p"/assets/site.css"} />
      </head>
      <body>
        <a href="#contenido" class="skip">Saltar al contenido</a>
        <header class="site-header">
          <a class="wordmark" href={~p"/"}><span aria-hidden="true">🍒</span> {@instance.name}</a>
          <nav aria-label="Navegación principal">
            <a href={~p"/transparencia"}>Cómo funciona</a>
            <a href={~p"/privacidad"}>Privacidad</a>
            <a href={~p"/contacto"}>Contacto</a>
          </nav>
        </header>
        <main id="contenido">{render_slot(@inner_block)}</main>
        <footer class="site-footer">
          <p class="wordmark">{@instance.name}</p>
          <p>Conocer gente, sin vender tu atención. Para mayores de 18 años.</p>
          <nav aria-label="Información del servicio">
            <a href={~p"/privacidad"}>Privacidad</a><a href={~p"/condiciones"}>Condiciones</a>
            <a href={~p"/normas"}>Normas</a><a href={~p"/seguridad-infantil"}>Seguridad infantil</a>
            <a href={~p"/eliminar-cuenta"}>Eliminar mi cuenta</a><a href={~p"/contacto"}>Titular y contacto</a>
          </nav>
          <p :if={@instance.operator}>Instancia gestionada por {@instance.operator}.</p>
          <p>
            <a :if={@instance.source_url} href={@instance.source_url} rel="noopener noreferrer">
              Código fuente · AGPL-3.0
            </a>
          </p>
        </footer>
      </body>
    </html>
    """
  end

  def draft(assigns) do
    ~H"""
    <aside class="draft" role="note">
      <strong>Información preparatoria · versión {Cherry.PublicSite.version()}</strong>
      <p>
        Esta web no anuncia la apertura del servicio. Los textos legales son provisionales y requieren completar datos y validación antes del lanzamiento.
      </p>
    </aside>
    """
  end
end
