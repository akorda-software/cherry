#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Verificar que adb está disponible
if ! command -v adb &> /dev/null; then
  echo "Error: adb no encontrado. Instala Android SDK."
  exit 1
fi

# Verificar que hay un emulador conectado
if ! adb devices | grep -q "emulator.*device"; then
  echo "Error: No hay emulador Android en ejecución."
  echo "Inicia un emulador desde Android Studio primero."
  exit 1
fi

echo "Emulador Android detectado."
echo "Compilando e instalando la app..."

cd "$ROOT_DIR/apps/mobile" && pnpm android
