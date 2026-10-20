defmodule CherryWeb.PageHTML do
  @moduledoc """
  This module contains pages rendered by PageController.

  See the `page_html` directory for all templates available.
  """
  use CherryWeb, :html

  embed_templates("page_html/*")

  # Muestra de la portada: etiquetas reales del catálogo, de todas las categorías.
  @landing_tags ~w(music cinema gaming travel cooking concerts hiking running yoga coffee chill party foodie environmentalist volunteer introvert curious dogs cats board_games)

  def landing_tags do
    by_slug = Map.new(Cherry.Dating.TagCatalog.entries(), &{&1.slug, &1})
    Enum.map(@landing_tags, &Map.fetch!(by_slug, &1))
  end

  def catalog_size, do: length(Cherry.Dating.TagCatalog.entries())

  def catalog_categories,
    do: Cherry.Dating.TagCatalog.entries() |> Enum.uniq_by(& &1.category) |> length()

  # Hojas de libreta pegadas bajo las ilustraciones, cada una de un papel y con
  # su borde: rayada con margen y agujeros de anillas, cuadriculada con borde de
  # tijera dentada, rota por abajo, milimetrada, de lunares y lisa con costura.
  # La trama es un patrón SVG propio, así que cada hoja lleva un id único.
  @sheets (fn ->
             num = &:erlang.float_to_binary(&1 / 1, decimals: 1)

             holes =
               Enum.map_join(0..5, fn i ->
                 "M#{70 + i * 100} 34a12 12 0 1 0 24 0a12 12 0 1 0-24 0Z"
               end)

             zigzag = Enum.map_join(0..39, fn i -> "L#{i * 16 + 8} 2L#{i * 16 + 16} 14" end)

             torn =
               Enum.map_join(34..0//-1, fn i ->
                 x = min(510, max(0, i * 15 + :math.sin(i * 2.3) * 3))
                 y = 528 + :math.sin(i * 1.7) * 9 + :math.sin(i * 4.1) * 6
                 "L#{num.(x)} #{num.(y)}"
               end)

             rect = fn w, h, r ->
               "M#{r} 0H#{w - r}a#{r} #{r} 0 0 1 #{r} #{r}V#{h - r}a#{r} #{r} 0 0 1-#{r} #{r}" <>
                 "H#{r}a#{r} #{r} 0 0 1-#{r}-#{r}V#{r}a#{r} #{r} 0 0 1 #{r}-#{r}Z"
             end

             %{
               "rayada" => %{
                 view_box: "0 0 640 520",
                 d: rect.(640, 520, 10) <> holes,
                 tile: {640, 32},
                 rule: "M0 31.2H640",
                 major: nil,
                 dots: nil,
                 margin: "M96 0V520",
                 stitch: nil
               },
               "cuadriculada" => %{
                 view_box: "0 0 640 420",
                 d: "M0 14" <> zigzag <> "V410a10 10 0 0 1-10 10H10a10 10 0 0 1-10-10Z",
                 tile: {24, 24},
                 rule: "M23.2 0V24M0 23.2H24",
                 major: nil,
                 dots: nil,
                 margin: nil,
                 stitch: nil
               },
               "rota" => %{
                 view_box: "0 0 510 560",
                 d: "M10 0H500a10 10 0 0 1 10 10V530" <> torn <> "V10a10 10 0 0 1 10-10Z",
                 tile: {510, 30},
                 rule: "M0 29.2H510",
                 major: nil,
                 dots: nil,
                 margin: nil,
                 stitch: nil
               },
               "milimetrada" => %{
                 view_box: "0 0 540 460",
                 d: rect.(540, 460, 10),
                 tile: {60, 60},
                 rule:
                   "M11.6 0V60M23.6 0V60M35.6 0V60M47.6 0V60M0 11.6H60M0 23.6H60M0 35.6H60M0 47.6H60",
                 major: "M59 0V60M0 59H60",
                 dots: nil,
                 margin: nil,
                 stitch: nil
               },
               "lunares" => %{
                 view_box: "0 0 520 480",
                 d: rect.(520, 480, 14),
                 tile: {40, 40},
                 rule: nil,
                 major: nil,
                 dots:
                   "M4 10a6 6 0 1 0 12 0a6 6 0 1 0-12 0ZM24 30a6 6 0 1 0 12 0a6 6 0 1 0-12 0Z",
                 margin: nil,
                 stitch: nil
               },
               "cosida" => %{
                 view_box: "0 0 460 460",
                 d: rect.(460, 460, 18),
                 tile: nil,
                 rule: nil,
                 major: nil,
                 dots: nil,
                 margin: nil,
                 stitch:
                   "M38 20H422a18 18 0 0 1 18 18V422a18 18 0 0 1-18 18H38a18 18 0 0 1-18-18V38a18 18 0 0 1 18-18Z"
               }
             }
           end).()

  attr(:id, :string, required: true)
  attr(:paper, :string, required: true)
  attr(:class, :string, required: true)
  # Escala de la trama: las hojas grandes la afinan para que el cuadro o la
  # raya tengan el mismo tamaño en pantalla que en las pequeñas.
  attr(:grain, :float, default: 1.0)

  @doc "Hoja de libreta pegada bajo una ilustración de la portada; decorativa."
  def sheet(assigns) do
    assigns = assign(assigns, Map.fetch!(@sheets, assigns.paper))

    ~H"""
    <svg class={["sheet", @class]} viewBox={@view_box} aria-hidden="true" focusable="false">
      <defs :if={@tile}>
        <pattern
          id={@id}
          width={elem(@tile, 0)}
          height={elem(@tile, 1)}
          patternUnits="userSpaceOnUse"
          patternTransform={@grain != 1.0 && "scale(#{@grain})"}
        >
          <rect class="sheet-paper" width={elem(@tile, 0)} height={elem(@tile, 1)} />
          <path :if={@rule} class="sheet-rule" d={@rule} />
          <path :if={@major} class="sheet-major" d={@major} />
          <path :if={@dots} class="sheet-dots" d={@dots} />
        </pattern>
      </defs>
      <path class="sheet-shadow" d={@d} fill-rule="evenodd" transform="translate(7 7)" />
      <path class="sheet-face" d={@d} fill-rule="evenodd" fill={@tile && "url(##{@id})"} />
      <path :if={@margin} class="sheet-margin" d={@margin} />
      <path :if={@stitch} class="sheet-stitch" d={@stitch} />
      <path class="sheet-edge" d={@d} fill-rule="evenodd" />
    </svg>
    """
  end

  # Sello festoneado de 18 ondas (detrás del carné), en una caja de 100×100.
  @seal_path (fn ->
                [{x0, y0} | rest] =
                  for i <- 0..18 do
                    angle = :math.pi() * (i / 9 - 0.5)
                    {50 + 40 * :math.cos(angle), 50 + 40 * :math.sin(angle)}
                  end

                num = &:erlang.float_to_binary(&1, decimals: 2)

                arcs =
                  Enum.map_join(rest, fn {x, y} -> "A7.6 7.6 0 0 1 #{num.(x)} #{num.(y)}" end)

                "M#{num.(x0)} #{num.(y0)}#{arcs}Z"
              end).()

  def seal_path, do: @seal_path

  # Formas del fondo (24×24): cara de rotulador con contorno de tinta y su sombra
  # dura, igual que las pegatinas. La cereza lleva además rabitos y hoja.
  @deco_shapes %{
    "heart" =>
      "M12 20.3C7.4 17.4 3 13.9 3 9.2 3 6.3 5.2 4 8 4c1.7 0 3.1.9 4 2.4C12.9 4.9 14.3 4 16 4c2.8 0 5 2.3 5 5.2 0 4.7-4.4 8.2-9 11.1Z",
    "sparkle" =>
      "M12 2c.8 5.6 3.6 8.4 9.2 9.2-5.6.8-8.4 3.6-9.2 9.2-.8-5.6-3.6-8.4-9.2-9.2C8.4 10.4 11.2 7.6 12 2Z",
    "star" =>
      "M12 2.4 14.6 8.4 21.1 9 16.2 13.4 17.6 19.8 12 16.4 6.4 19.8 7.8 13.4 2.9 9 9.4 8.4Z",
    "circle" => "M11.4 2.8a8.6 8.6 0 1 1 0 17.2 8.6 8.6 0 1 1 0-17.2Z",
    "plus" => "M9 3.5h5V9h5.5v5H14v5.5H9V14H3.5V9H9Z",
    "cherry" =>
      "M7.5 11.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 1 1 0-9.2ZM16.5 10.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 1 1 0-9.2Z"
  }

  attr(:shape, :string, required: true)
  attr(:class, :string, required: true)
  # Altura sobre el papel: 1 casi pegada, 2 en el aire, 3 muy cerca. La sombra
  # se separa más cuanto más alta está, y con el scroll se adelanta más.
  attr(:lift, :integer, default: 1)

  @doc "Forma decorativa del fondo de la portada; los lectores de pantalla la ignoran."
  def deco(assigns) do
    assigns =
      assign(assigns,
        d: Map.fetch!(@deco_shapes, assigns.shape),
        offset: Enum.at([0.9, 1.6, 2.4], assigns.lift - 1)
      )

    ~H"""
    <svg
      class={["deco", "lift-#{@lift}", @class]}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path class="deco-shadow" d={@d} transform={"translate(#{@offset} #{@offset})"} />
      <path class="deco-face" d={@d} />
      <path :if={@shape == "cherry"} class="deco-stem" d="M7.5 11.4Q9 6 14 3M16.5 10.4Q15.8 6 14 3" />
      <path :if={@shape == "cherry"} class="deco-leaf" d="M14 3Q17.6.8 21.2 2.6 18 6.2 14 3Z" />
    </svg>
    """
  end

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
        <meta name="theme-color" content="#FAF6F0" />
        <title>{@title} · {@instance.name}</title>
        <link rel="icon" href={~p"/images/mochi.svg"} type="image/svg+xml" />
        <link rel="stylesheet" href={~p"/assets/site.css"} />
      </head>
      <body>
        <a href="#contenido" class="skip">Saltar al contenido</a>
        <header class="site-header">
          <a class="brand" href={~p"/"}>
            <CherryWeb.Brand.mochi size={44} class="brand-mochi" />
            <span>{@instance.name}</span>
          </a>
          <nav aria-label="Navegación principal">
            <a href={~p"/" <> "#como-funciona"}>Cómo funciona</a>
            <a href={~p"/privacidad"}>Privacidad</a>
            <a href={~p"/contacto"}>Contacto</a>
          </nav>
        </header>
        <main id="contenido">{render_slot(@inner_block)}</main>
        <footer class="site-footer">
          <div class="footer-inner">
            <div class="footer-brand">
              <CherryWeb.Brand.mochi size={64} />
              <p class="footer-name">{@instance.name}</p>
              <p>Para conocer gente, sin vender tu atención. Solo para mayores de 18 años.</p>
            </div>
            <nav aria-label="Información del servicio">
              <a href={~p"/privacidad"}>Privacidad</a>
              <a href={~p"/condiciones"}>Condiciones</a>
              <a href={~p"/normas"}>Normas</a>
              <a href={~p"/seguridad-infantil"}>Seguridad infantil</a>
              <a href={~p"/transparencia"}>Transparencia</a>
              <a href={~p"/eliminar-cuenta"}>Eliminar mi cuenta</a>
              <a href={~p"/contacto"}>Titular y contacto</a>
              <a href={~p"/aviso-legal"}>Aviso legal</a>
              <a href={~p"/cookies"}>Cookies</a>
            </nav>
            <div class="footer-meta">
              <p :if={@instance.operator}>Instancia gestionada por {@instance.operator}.</p>
              <p :if={@instance.source_url}>
                <a href={@instance.source_url} rel="noopener noreferrer">Código fuente (AGPL-3.0)</a>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
    """
  end

  def draft(assigns) do
    ~H"""
    <aside class="draft" role="note">
      <strong>Información preparatoria, versión {Cherry.PublicSite.version()}</strong>
      <p>
        Esta web no anuncia la apertura del servicio. Los textos legales son provisionales y requieren completar datos y validación antes del lanzamiento.
      </p>
    </aside>
    """
  end
end
