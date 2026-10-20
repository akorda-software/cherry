defmodule CherryWeb.Brand do
  @moduledoc """
  Piezas de marca compartidas por la web pública y el backoffice: Mochi (el logo
  provisional de la app, `apps/mobile/assets/brand/mochi-love.svg`) y un set
  pequeño de iconos SVG geométricos con trazo de tinta.

  Van en línea para no depender de `img-src`: las dos CSP son estrictas y el
  backoffice no carga imágenes.
  """
  use Phoenix.Component

  attr(:class, :string, default: nil)
  attr(:size, :integer, default: 40)

  @doc "Mochi enamorada, el logo provisional (mismo dibujo que el icono de la app)."
  def mochi(assigns) do
    ~H"""
    <svg
      class={@class}
      width={@size}
      height={@size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M42 61Q46 34 70 18M81 57Q77 36 70 18"
        stroke="#1D1426"
        stroke-width="3.5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M70 18Q84 8 99 16Q88 28 70 18Z"
        fill="#62D98C"
        stroke="#1D1426"
        stroke-width="3.15"
        stroke-linejoin="round"
      />
      <circle cx="45" cy="87" r="22" fill="#1D1426" />
      <circle cx="40" cy="82" r="22" fill="#E6493B" stroke="#1D1426" stroke-width="3.5" />
      <circle cx="87" cy="83" r="22" fill="#1D1426" />
      <circle cx="82" cy="78" r="22" fill="#E6493B" stroke="#1D1426" stroke-width="3.5" />
      <g
        :for={{x, y} <- [{27, 74}, {41, 74}, {70, 70}, {83, 70}]}
        transform={"translate(#{x} #{y}) scale(0.5)"}
      >
        <path
          class="mochi-eye"
          d="M12 20.25C7.4 17.4 3 13.9 3 9.2 3 6.3 5.2 4 8 4c1.7 0 3.1.9 4 2.4.9-1.5 2.3-2.4 4-2.4 2.8 0 5 2.3 5 5.2 0 4.7-4.4 8.2-9 11.05Z"
          fill="#1D1426"
        />
      </g>
      <path
        d="M36 91Q41 95 46 90.5M78 87Q83 91 88 86.5"
        stroke="#1D1426"
        stroke-width="2.975"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
    """
  end

  @icons %{
    "heart" =>
      ~s(<path d="M12 20.3C7.4 17.4 3 13.9 3 9.2 3 6.3 5.2 4 8 4c1.7 0 3.1.9 4 2.4C12.9 4.9 14.3 4 16 4c2.8 0 5 2.3 5 5.2 0 4.7-4.4 8.2-9 11.1Z" fill="currentColor" stroke="none"/>),
    "close" => ~s(<path d="M6 6l12 12M18 6 6 18"/>),
    "check" => ~s(<path d="M5 12.5 10 17 19 7"/>),
    "back" => ~s(<path d="M14.5 5.5 8 12l6.5 6.5"/>),
    "sparkle" =>
      ~s(<path d="M12 2.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5Z" fill="currentColor" stroke="none"/>),
    "flag" => ~s(<path d="M6 21V4M6 4h11l-2.5 4.5L17 13H6"/>),
    "block" => ~s(<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>),
    "pause" =>
      ~s(<rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/>),
    "trash" => ~s(<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>),
    "pin" =>
      ~s(<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.2"/>),
    "id" =>
      ~s(<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5.8 16c.6-1.4 1.6-2 2.7-2s2.1.6 2.7 2M14 10h4M14 14h3"/>),
    "chat" => ~s(<path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4Z"/>),
    "code" => ~s(<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5"/>),
    "user" =>
      ~s(<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>),
    "inbox" =>
      ~s(<path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17Z"/><path d="M3.5 13.5h5l1 2.5h5l1-2.5h5"/>),
    "team" =>
      ~s(<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.9-3.2 3.2-5 6-5s5.1 1.8 6 5"/><path d="M15.5 5.6a3.2 3.2 0 1 1 0 6.1M17.5 14.6c1.7.6 2.9 2.2 3.5 4.9"/>),
    "key" => ~s(<circle cx="8" cy="12" r="4.5"/><path d="M12.5 12H21M18 12v3.5M21 12v2.5"/>),
    "logout" => ~s(<path d="M14 4.5H19.5v15H14M10.5 8 6.5 12l4 4M6.5 12h10"/>),
    "clock" => ~s(<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>),
    "lock" =>
      ~s(<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>),
    "home" =>
      ~s(<path d="M4 11 12 4.5l8 6.5"/><path d="M6.5 9.5V19.5h11V9.5"/><path d="M10 19.5v-5h4v5"/>),
    "search" => ~s(<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>),
    "note" => ~s(<path d="M5 4.5h10l4 4v11H5Z"/><path d="M15 4.5v4h4M8.5 12.5h7M8.5 16h4.5"/>),
    "next" => ~s(<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/>),
    "shield" =>
      ~s(<path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>),
    "link" =>
      ~s(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>),
    "undo" => ~s(<path d="M9 7 4.5 11.5 9 16"/><path d="M4.5 11.5h10a5 5 0 0 1 0 10H12"/>)
  }

  attr(:name, :string, required: true)
  attr(:class, :string, default: "icon")

  @doc "Icono de trazo de tinta (24×24, hereda `currentColor`)."
  def icon(assigns) do
    assigns = assign(assigns, :body, Map.fetch!(@icons, assigns.name))

    ~H"""
    <svg
      class={@class}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {Phoenix.HTML.raw(@body)}
    </svg>
    """
  end
end
