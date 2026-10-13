// Rellena cada `.screen[data-shot]` con la barra de estado y la captura de
// `docs/assets/screens/<nombre>.png`. Con `?dark` en la URL, aplica la
// variante para el modo oscuro de GitHub.
if (new URLSearchParams(location.search).has("dark")) {
  document.documentElement.classList.add("dark");
}

const STATUS_ICONS = `
  <svg width="62" height="14" viewBox="0 0 62 14" fill="currentColor" aria-hidden="true">
    <rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/>
    <rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/>
    <path d="M30 13.5l-2.6-3.1a4 4 0 0 1 5.2 0zM24.6 7.3a8.4 8.4 0 0 1 10.8 0l-1.6 1.9a5.9 5.9 0 0 0-7.6 0zM21.8 4a12.8 12.8 0 0 1 16.4 0l-1.6 1.9a10.3 10.3 0 0 0-13.2 0z"/>
    <rect x="42.5" y="1.5" width="16" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <rect x="44.5" y="3.5" width="10" height="7" rx="1.5"/><rect x="59.5" y="5" width="1.8" height="4" rx="0.9"/>
  </svg>`;

for (const screen of document.querySelectorAll(".screen[data-shot]")) {
  screen.innerHTML = `
    <div class="island"></div>
    <div class="status"><span>9:41</span>${STATUS_ICONS}</div>
    <img class="shot" src="../screens/${screen.dataset.shot}.png" alt="">`;
}
