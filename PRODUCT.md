# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

App nativa iOS + Android con Expo (SDK 54, React Native 0.81, nueva arquitectura). Un único lenguaje de marca compartido en ambos sistemas; las affordances nativas (safe areas, gesto/botón atrás, teclado, hápticos, permisos) se adaptan a cada OS. Expo Web se usa solo como banco de pruebas en desarrollo, no es una superficie de producto.

## Users

Adultos (18+) que quieren conocer gente para pareja, algo casual, amistad o "a ver qué pasa", cansados de apps de citas caras y predatorias. Usan la app en el móvil, en ratos sueltos (sofá, transporte, antes de dormir), con sesiones cortas de descubrir perfiles y chatear. *(Inferido del brief: público hispanohablante de España; idioma de producto español de España con tuteo.)*

## Product Purpose

Snack es una app de citas **open source, 100 % gratuita y self-hosteable**. Existe para demostrar que una app de citas puede servir a las personas en lugar de explotarlas: sin muros de pago, sin mecánicas para retenerte en el mercado, sin vender tu atención. El éxito es que la gente haga matches reales, se sienta cómoda y a gusto usándola, y que el proyecto gane reputación por lo bien hecho que está.

## Positioning

- Gratis de verdad y para siempre: todo lo que otras apps cobran (ver quién te ha dado like, filtros, etc.) aquí es gratuito.
- Open source (AGPL-3.0) y self-hosteable: cualquiera puede auditarla o montar su propia instancia (`docs/12-self-hosting.md`), y nadie puede cerrar una versión modificada.
- Las **etiquetas** son el núcleo: cada persona elige etiquetas que la definen (positivas) y etiquetas que bloquea; el algoritmo nunca muestra a alguien con una etiqueta bloqueada, y la compatibilidad por etiquetas pesa más que la proximidad pura.
- Filosofía anti-predatoria: la app busca que el usuario esté cómodo y consiga lo que necesita, no maximizar el tiempo de uso.

## Operating Context

- Dos formas de conocer gente: **swipe** clásico (derecha me gusta, izquierda no) y un **feed** vertical tipo Instagram en el que vas bajando, ves perfiles y entras en ellos.
- Onboarding rápido (inspirado en Tinder/Hinge): lo mínimo para empezar, sin formularios eternos.
- Tras un match mutuo se abre un chat de texto (REST para historial + WebSocket en vivo).
- Pestaña de **Likes** gratuita y visible: ves quién te ha dado like; si le das like, es match al instante.
- Herramientas de seguridad: bloquear, reportar, deshacer match, pausar perfil y borrar cuenta.

## Capabilities and Constraints

- Backend Phoenix + PostgreSQL/PostGIS; auth solo con Google y Apple (sesiones propias de Phoenix); fotos subidas a almacenamiento S3-compatible (R2, MinIO…) o al disco del propio servidor (self-hosting), siempre con verificación en servidor.
- Perfil: nombre, fecha de nacimiento (18+), género (hombre / mujer / no binario), a quién quiere conocer (multiselección), qué busca (relación / casual / conocer gente / a ver qué pasa), bio de 20–240 caracteres, 2–4 fotos, ubicación aproximada (rejilla de 500 m, nunca coordenadas exactas).
- Etiquetas: catálogo cerrado de 52 en 7 categorías (intereses, vida activa, estilo de vida, valores, personalidad, mascotas, relación y familia); máx. 8 positivas y máx. 5 bloqueadas. El bloqueo de etiquetas se aplica en ambas direcciones.
- Intención: cada intención ve la suya más "a ver qué pasa", que es compatible con todas; la misma intención puntúa más; relación y casual nunca se cruzan. Simétrico.
- Match por like mutuo; el match caduca a los **30 días** si nadie escribe (decisión 2026-09-29, sustituye a los 7 días del v1). Chat solo texto.
- Likes ilimitados, sin cuotas diarias; protecciones anti-abuso técnicas, nunca límites de monetización.
- Sin monetización de ningún tipo (sin super likes, boosts de pago, suscripciones ni anuncios).

## Brand Commitments

- Nombre: **Snack**.
- Estética vinculante pedida por el propietario: **neobrutalismo kawaii a tope** con colores **pastel** muy vivos, animaciones y microinteracciones cuidadas; una app que "te abraza", cálida y optimista (referencia de tono: Ted Lasso).
- Voz: español de España, cercana, con humor amable y cero sarcasmo; nunca culpabiliza ni presiona.

## Evidence on Hand

- Catálogo real de 52 etiquetas con emoji en `apps/backend/lib/snack/dating/tag_catalog.ex` (lo sincronizan `priv/repo/seeds.exs` y `bin/migrate`).
- Documentación de producto y contratos en `docs/`.
- No hay testimonios, usuarios reales, métricas ni prensa: no se deben inventar cifras, reseñas ni número de usuarios.

## Product Principles

1. El usuario primero: comodidad, claridad y control antes que retención o engagement.
2. Gratis sin asteriscos: ninguna función se esconde detrás de un pago ni se simula escasez.
3. Las etiquetas mandan: la compatibilidad declarada y los bloqueos se respetan siempre.
4. Rápido de empezar, agradable de usar: cada pantalla pide lo mínimo y recompensa cada paso.
5. Seguridad y respeto integrados: bloquear, reportar y pausar están siempre a mano.

## Accessibility & Inclusion

- Géneros no binarios de primera clase en perfil y preferencias.
- Contraste legible sobre fondos pastel (texto en tinta oscura), objetivos táctiles ≥ 44–48 pt, soporte de "reducir movimiento" del sistema para las animaciones, y lectores de pantalla (etiquetas accesibles en botones de iconos y gestos de swipe con alternativa en botones).
