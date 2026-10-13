# Visión y alcance

## Qué es Cherry

Cherry es una **app de citas móvil open source, 100 % gratuita y self-hosteable** (licencia AGPL-3.0). Existe para demostrar que una app de citas puede servir a las personas en lugar de explotarlas: sin muros de pago, sin escasez simulada, sin anuncios y sin mecánicas para retenerte. Lo que otras apps cobran (ver quién te ha dado like, filtros, deshacer) aquí es gratis. Cualquiera puede auditar el código o montar su propia instancia (`12-self-hosting.md`). Brief de producto y compromisos de marca: `PRODUCT.md`.

Está construida sobre un **starter reusable** (Expo + Phoenix), y dos capas conviven en el repositorio:

1. **Starter (base reusable):** auth nativa Google/Apple con sesiones propiedad de Phoenix, bootstrap de sesión y refresh, design system con tokens, feature flags runtime y shell de navegación.
2. **Producto dating:** onboarding en 11 pasos, discovery por ubicación en modo swipe o feed, likes recibidos visibles, matching por like mutuo, chat de texto en tiempo real y herramientas de seguridad, con la identidad visual «Libreta kawaii».

## Principios de producto

- El MVP debe sentirse completo, no sobrecargado.
- La calidad del matching importa más que añadir features.
- Compatibilidad por encima de proximidad pura; la proximidad sigue importando.
- Los bloqueos duros (género, edad, intent, tags bloqueados) se respetan estrictamente.
- La app debe funcionar tanto con poca oferta como con mucha.
- Seguridad, moderación y tooling de admin son parte del producto, no extras.
- Anti-predatoria: la app busca que la persona esté cómoda y consiga lo que necesita, no maximizar el tiempo de uso.
- Las etiquetas mandan: la compatibilidad declarada y los bloqueos por etiqueta se respetan siempre, en ambas direcciones.

## Usuarios objetivo

Personas que quieren una experiencia de dating simple: completar un perfil rápido, filtrar por intento y distancia, ver perfiles que encajan de verdad con sus preferencias básicas y chatear sin fricción tras un match.

## Superficies de producto

1. Autenticación
2. Creación de perfil (onboarding)
3. Feed de discovery
4. Match y chat
5. Seguridad y controles de cuenta

## Fuera de alcance en v1

- Monetización de cualquier tipo (super likes, boosts de pago, suscripciones, anuncios): fuera para siempre, no solo en v1
- Chat con imágenes, audio o vídeo
- Sistemas de personalidad complejos o ranking con ML
- Prompts estilo Hinge
- Flujos avanzados de verificación
- Auth por email/teléfono (solo Google/Apple)

## Alcance v1

Estado de cada punto en `10-plan-fases.md`.

- Sign-in Apple y Google
- Onboarding obligatorio con perfil completo (bio, fotos, intent, tags, preferencias, ubicación)
- Discovery basado en ubicación, en modo swipe o feed, con ampliación de distancia si hay poca oferta
- Matching por like mutuo + chat solo texto
- Expiración del match a los 30 días sin mensajes (D-2026-09-29)
- Likes recibidos visibles y gratis; deshacer el último «no» gratis
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
- Imágenes subidas a almacenamiento S3 compatible (Cloudflare R2, MinIO…) o al disco del propio servidor en instancias self-hosted; el backend verifica cada subida y guarda metadatos/URLs
- Infra self-hosted

## Relación starter ↔ dating

El dating se construye **encima** del starter, no mezclado: features de producto en `features/<dominio>` con sus capas, contratos compartidos en `packages/contracts`, y la UI compartida sin lógica de producto. Ver `02-arquitectura.md` y `starter-guide.md`.
