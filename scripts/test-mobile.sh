#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "==> Type-checking @snack/mobile"
pnpm --filter @snack/mobile typecheck

echo "==> Type-checking @snack/mobile-shared"
pnpm --filter @snack/mobile-shared typecheck

echo "==> Running @snack/mobile-shared tests"
pnpm --filter @snack/mobile-shared test

echo "==> Running @snack/mobile tests"
pnpm --filter @snack/mobile test

echo "==> Running @snack/contracts tests"
pnpm --filter @snack/contracts test
