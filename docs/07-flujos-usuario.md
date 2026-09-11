# Flujos de usuario

Pantallas y recorridos **implementados hoy** en la app móvil (`apps/mobile/app`). Lo planificado y pendiente está en `10-plan-fases.md`.

## Mapa de rutas actual

```
app/
├── _layout.tsx / index.tsx        # root: resuelve sesión + bootstrap → public | onboarding | app
├── (public)/login                 # Google / Apple (+ botón test-login en dev)
├── (onboarding)/
│   ├── index                      # resolver nextOnboardingStep → paso
│   ├── profile                    # nombre + fecha nacimiento + género + intent
│   ├── preferences                # interested-in + rango edad + distancia
│   ├── bio                        # bio (placeholder de fotos)
│   └── tags                       # tags positivos + bloqueados + "Finalizar y entrar"
└── (app)/
    ├── (tabs)/home                # discovery feed ("Descubrir")
    ├── (tabs)/profile             # perfil propio
    └── settings                   # placeholder + logout + módulos opcionales
```

## Autenticación

1. Login con Google o Apple (nativos) o test-login dev.
2. La credencial viaja a `POST /api/auth/:provider/callback`; Phoenix emite la sesión.
3. Bundle de sesión en secure storage; bootstrap inmediato.

## Bootstrap y routing

Al abrir la app (y tras cada auth): `GET /api/config` → flags; `GET /api/bootstrap` → estado.

- Sin sesión → login. Error de bootstrap con sesión activa → mensaje de error en pantalla (solo cae a login si la sesión queda signed-out).
- `onboardingRequired` → `(onboarding)/index`, que redirige al paso de `nextOnboardingStep`.
- Perfil completo → tabs `(app)`.

## Onboarding (parcial)

Stepper navegable entre pasos; cada paso guarda en el backend antes de avanzar:

1. **Perfil** — nombre, fecha, género, intent → `PUT /api/me/profile`.
2. **Bio** — texto con validación local (placeholder donde irán las fotos).
3. **Preferencias** — interested-in multi-selección, edad min/max, distancia → `PUT /api/me/discovery-preferences`.
4. **Tags** — positivos (máx. 8) y bloqueados (máx. 5) del catálogo (`GET /api/tags`) → `PUT /api/me/tags` / `PUT /api/me/blocked-tags`; botón «Finalizar y entrar» llama `POST /api/me/profile/complete`.

> Estado conocido: sin los pasos de fotos y ubicación, `complete` devuelve `profile_incomplete` para usuarios nuevos. Ver `11-deuda-tecnica-pendiente.md`.

## Discovery feed

- Grilla de cards (FlashList) con paginación por cursor contra `GET /api/discovery/feed`.
- Tap en card → hoja de detalle con like/dislike.
- Like/dislike optimista con rollback si falla (`POST /api/discovery/actions`).
- Al crear match → modal de celebración («Seguir descubriendo»).

## Perfil y ajustes

- Tab perfil propio; settings con logout.

## Flujos aún no implementados

Location (permiso + remediación), fotos (picker + R2), review de completion, matches list, chat (REST + WS), safety (block/report), pause/unpause/delete account. Planificados en `10-plan-fases.md`.
