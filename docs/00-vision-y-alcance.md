# Visión y alcance

## Qué es Snack

Snack es una **app de dating móvil** de alcance reducido y alta exigencia de relevancia, construida sobre un **starter reusable** (Expo + Phoenix) pensado para servir de base a varias apps.

Dos capas conviven en el repositorio:

1. **Starter (base reusable):** auth nativa Google/Apple con sesiones propiedad de Phoenix, bootstrap de sesión y refresh, design system con tokens, feature flags runtime y shell de navegación.
2. **Producto dating:** onboarding con perfil obligatorio, discovery por ubicación, matching por like mutuo, chat de texto y herramientas de seguridad.

## Principios de producto

- El MVP debe sentirse completo, no sobrecargado.
- La calidad del matching importa más que añadir features.
- Compatibilidad por encima de proximidad pura; la proximidad sigue importando.
- Los bloqueos duros (género, edad, intent, tags bloqueados) se respetan estrictamente.
- La app debe funcionar tanto con poca oferta como con mucha.
- Seguridad, moderación y tooling de admin son parte del producto, no extras.

## Usuarios objetivo

Personas que quieren una experiencia de dating simple: completar un perfil rápido, filtrar por intento y distancia, ver perfiles que encajan de verdad con sus preferencias básicas y chatear sin fricción tras un match.

## Superficies de producto

1. Autenticación
2. Creación de perfil (onboarding)
3. Feed de discovery
4. Match y chat
5. Seguridad y controles de cuenta

## Fuera de alcance en v1

- Monetización y mecánicas premium (super likes, boosts)
- Chat con imágenes, audio o vídeo
- Sistemas de personalidad complejos o ranking con ML
- Prompts estilo Hinge
- Flujos avanzados de verificación
- Auth por email/teléfono (solo Google/Apple)

## Alcance v1

- Sign-in Apple y Google
- Onboarding obligatorio con perfil completo (bio, fotos, intent, tags, distancia, ubicación)
- Discovery basado en ubicación con fallback gradual por poca oferta
- Matching por like mutuo + chat solo texto
- Expiración del match a los 7 días sin mensajes
- Likes ilimitados con protección anti-abuso
- Boost controlado para usuarios nuevos
- Acciones de seguridad (block/report/pause/delete) y moderación básica
- Métricas básicas de producto

## v1.1 (refinamiento, no expansión)

- Auth por teléfono
- Ajuste del catálogo de tags y pesos de ranking con métricas reales
- Mejor tuning del fallback por poca oferta
- Más tooling de admin y workflows de moderación
- Área de búsqueda manual opcional

## Infraestructura asumida

- Móvil Expo; backend Phoenix; PostgreSQL + PostGIS
- Imágenes subidas directamente a Cloudflare R2 (el backend solo guarda metadatos/URLs)
- Infra self-hosted

## Relación starter ↔ dating

El dating se construye **encima** del starter, no mezclado: features de producto en `features/<dominio>` con sus capas, contratos compartidos en `packages/contracts`, y la UI compartida sin lógica de producto. Ver `02-arquitectura.md` y `starter-guide.md`.
