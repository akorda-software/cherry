#!/usr/bin/env bash
# Genera las imágenes del README a partir de los HTML de esta carpeta, con
# Chrome sin interfaz. Cada imagen sale en dos variantes: para el modo claro y
# para el modo oscuro de GitHub.
#
#   docs/assets/src/render.sh
#
# Las capturas de `docs/assets/screens/` son de la app en el navegador
# (`pnpm --dir apps/mobile start`, tecla «w») con la cuenta demo, a 390×844 y 2x.
# Las fotos de perfil están sustituidas por retratos ilustrados: nunca uses
# fotos de personas reales.
set -euo pipefail

cd "$(dirname "$0")"
chrome="${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser)}"
out=..

# nombre ancho alto
images=(
  "banner 1240 600"
  "showcase 1240 590"
  "countries 1240 300"
)

for spec in "${images[@]}"; do
  read -r name width height <<<"$spec"
  for variant in light dark; do
    query=""
    [ "$variant" = dark ] && query="?dark"
    "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
      --force-device-scale-factor=2 --default-background-color=00000000 \
      --window-size="$width,$height" --virtual-time-budget=3000 \
      --screenshot="$out/$name-$variant.png" "file://$PWD/$name.html$query" 2>/dev/null
    echo "$out/$name-$variant.png"
  done
done

# Paleta de 256 colores: las imágenes pesan la cuarta parte y no se nota.
if command -v python3 >/dev/null && python3 -c "import PIL" 2>/dev/null; then
  python3 - "$out" <<'EOF'
import sys, glob
from PIL import Image
for path in glob.glob(f"{sys.argv[1]}/*-light.png") + glob.glob(f"{sys.argv[1]}/*-dark.png"):
    Image.open(path).convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
EOF
fi
