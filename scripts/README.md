# Scripts

Repository-level entrypoints used from the root workspace.

Current scripts:

- `test-mobile.sh` — runs contracts and mobile tests together
- `test-backend.sh` — runs Phoenix tests in `apps/backend`

Root `package.json` delegates to these so CI and local workflows stay consistent.
