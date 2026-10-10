#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "==> Type-checking @cherry/mobile"
pnpm --filter @cherry/mobile typecheck

echo "==> Type-checking @cherry/mobile-shared"
pnpm --filter @cherry/mobile-shared typecheck

echo "==> Running @cherry/mobile-shared tests"
pnpm --filter @cherry/mobile-shared test

echo "==> Running @cherry/mobile tests"
pnpm --filter @cherry/mobile test

echo "==> Running @cherry/contracts tests"
pnpm --filter @cherry/contracts test
