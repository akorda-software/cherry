#!/usr/bin/env bash
# PLAN B (emergencia) — deploy como release + systemd sin Dokploy.
# El camino principal es Dokploy + GHCR (ver README.md de esta carpeta y D-2026-09-04).
#
# Uso: ./deploy-backend.sh <usuario@host> [versión]
# ej.: ./deploy-backend.sh kukapu@192.168.0.126
#
# Construye el release en Docker (reproducible), lo sube a /opt/snack/releases/<versión>,
# apunta el symlink current, ejecuta migraciones y reinicia el servicio.
# Requiere provisioning previo (ver README.md de esta carpeta).

set -euo pipefail

REMOTE=${1:?Uso: deploy-backend.sh <usuario@host> [versión]}
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION=${2:-$(git -C "$ROOT" rev-parse --short HEAD)}
TARBALL="/tmp/snack-${VERSION}.tar.gz"
REMOTE_SCRIPT="/tmp/snack-remote-deploy.sh"

echo "==> Versión: $VERSION"

echo "==> Construyendo release (Docker builder)"
docker build --target builder -t snack-backend:builder "$ROOT/apps/backend"

echo "==> Extrayendo tarball"
docker run --rm snack-backend:builder sh -c 'cat /app/_build/prod/snack-*.tar.gz' > "$TARBALL"

cat > "$REMOTE_SCRIPT" <<'SCRIPT'
set -euo pipefail

APP=/opt/snack
REL="$APP/releases/$VERSION"

install -d -o snack -g snack -m 755 "$REL"
sudo -u snack tar -xzf "/tmp/snack-${VERSION}.tar.gz" -C "$REL"
ln -sfn "$REL" "$APP/current"

sudo -u snack bash -c "set -a; . $APP/env; set +a; $APP/current/bin/migrate"
systemctl restart snack-backend
rm -f "/tmp/snack-${VERSION}.tar.gz" "$0"

systemctl --no-pager --lines 5 status snack-backend
SCRIPT

echo "==> Subiendo a $REMOTE"
scp -q "$TARBALL" "$REMOTE_SCRIPT" "$REMOTE:/tmp/"

echo "==> Desplegando (sudo pedirá contraseña; la terminal está reservada con -t)"
ssh -t "$REMOTE" "sudo VERSION=$VERSION bash $REMOTE_SCRIPT"

echo "==> Hecho: $VERSION en $REMOTE"
