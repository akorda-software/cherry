<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/banner-dark.png">
  <img src="./docs/assets/banner-light.png" width="100%" alt="Cherry: citas abiertas, hechas para las personas. Open source y self-hosteable, para que cada país tenga su propio Cherry. Junto al texto, Mochi (la mascota, dos cerezas sonrientes) y dos móviles con la app: la pantalla de descubrir y la de likes.">
</picture>

<br>

[![Licencia AGPL-3.0](https://img.shields.io/badge/licencia-AGPL--3.0-FF6B57?style=for-the-badge&labelColor=1D1426)](./COPYRIGHT.md)
[![Estado: en construcción](https://img.shields.io/badge/estado-en_construcci%C3%B3n-FFC53D?style=for-the-badge&labelColor=1D1426)](./docs/10-plan-fases.md)
[![Contribuir con DCO](https://img.shields.io/badge/contribuir-DCO-62D98C?style=for-the-badge&labelColor=1D1426)](./CONTRIBUTING.md)
<br>
[![Expo SDK 54](https://img.shields.io/badge/Expo_SDK_54-1D1426?style=for-the-badge&logo=expo&logoColor=FAF6F0)](./apps/mobile)
[![Elixir y Phoenix](https://img.shields.io/badge/Elixir_%C2%B7_Phoenix-A58BFF?style=for-the-badge&logo=elixir&logoColor=1D1426&labelColor=A58BFF)](./apps/backend)
[![PostgreSQL 18 con PostGIS](https://img.shields.io/badge/PostgreSQL_18_%C2%B7_PostGIS-5EC0FF?style=for-the-badge&logo=postgresql&logoColor=1D1426)](./infra/docker-compose.yml)
[![iOS y Android](https://img.shields.io/badge/iOS_%C2%B7_Android-B9E53C?style=for-the-badge&logo=android&logoColor=1D1426)](./apps/mobile)

**[Qué es](#qué-es-cherry)** · **[La app](#la-app)** · **[Un Cherry por país](#un-cherry-por-país)** · **[Arrancarlo](#arrancarlo-en-tu-ordenador)** · **[Montar tu instancia](#montar-tu-instancia)** · **[Contribuir](#contribuir)** · **[Licencia](#licencia)**

</div>

> [!NOTE]
> **Cherry está en construcción.** La app funciona de punta a punta en desarrollo, pero todavía no está publicada en las tiendas. La identidad visual (logo, mascota, colores) es provisional y irá cambiando.

## Qué es Cherry

Cherry es una app de citas **open source y self-hosteable**. Existe para demostrar que una app de citas puede servir a las personas en lugar de explotarlas: sin muros de pago, sin escasez simulada, sin anuncios y sin trucos para que pases más tiempo dentro. Lo que otras apps cobran (ver quién te ha dado like, los filtros, deshacer) aquí forma parte de la app.

<table>
<tr>
<td width="50%" valign="top">

### 🏷️ Las etiquetas mandan

Eliges las etiquetas que te definen y las que no van contigo. Nunca verás a nadie con una etiqueta que bloqueas, ni te verá a ti, y la compatibilidad pesa más que la distancia.

</td>
<td width="50%" valign="top">

### 🛡️ Solo personas reales y adultas

Cada cuenta comprueba su mayoría de edad con el DNI o con un selfie. Cada documento vale para una sola cuenta, así que los bots y los expulsados no vuelven con otra.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🤝 Sin presión

Tono cálido, sin culpa y sin notificaciones para engancharte. La app quiere que encuentres lo que buscas, no que no la sueltes.

</td>
<td width="50%" valign="top">

### 🔓 Tuya

Código auditable bajo AGPL-3.0. Cualquiera puede montar su propio Cherry para su país, con el mismo nombre y la misma mascota.

</td>
</tr>
</table>

## La app

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/showcase-dark.png">
  <img src="./docs/assets/showcase-light.png" width="100%" alt="Cinco pantallas de Cherry: descubrir perfiles con sus etiquetas, la lista de personas que te han dado like, los chats con los nuevos matches, tu perfil tal como lo ven los demás y la elección del método para comprobar la edad.">
</picture>
<sub>Capturas de la versión en desarrollo con perfiles de demo. Las fotos son retratos ilustrados.</sub>
</div>

### Qué incluye hoy

- **Login** con Google y Apple; sesiones propias con refresco rotatorio.
- **Comprobación de la edad** tras el onboarding, explicada paso a paso:
  - **DNI por NFC** (recomendada): el móvil lee los datos del chip del DNI o el pasaporte (no la foto) y el servidor comprueba la firma del Estado. Sin coste y sin terceros.
  - **Selfie y foto del documento** con [Didit](https://didit.me), para quien no tiene NFC.
  - Solo se guarda «mayor de edad: sí», la fecha y una huella cifrada del documento. Si el documento es de un menor, se borra la cuenta entera.
- **Onboarding en 11 pasos**: nombre, cumpleaños, género, a quién quieres conocer, qué buscas, fotos, etiquetas, etiquetas bloqueadas, bio y ubicación aproximada.
- **Descubrir** en modo swipe o feed, con un ranking que prioriza etiquetas en común, intención compatible, reciprocidad y actividad real, y filtros de edad, distancia y etiquetas.
- **Likes visibles**: ves quién te ha dado like y, si le das like, es match al momento. Deshacer tu último «no».
- **Chats** en tiempo real tras un match, con estado de lectura. Un match sin mensajes caduca a los 30 días.
- **Seguridad**: bloquear, denunciar, deshacer un match, pausar el perfil y borrar la cuenta.
- **Privacidad**: la ubicación se redondea a una rejilla de 500 m y nunca se expone, y los mensajes se cifran en reposo.
- **Fotos** en el disco del servidor o en cualquier almacenamiento compatible con S3.
- Sistema de diseño **«Libreta kawaii»**: neobrutalismo sobrio con color, con Mochi de mascota.

Lo que falta (notificaciones push, panel de moderación, otros idiomas, modo oscuro…) está en el [plan por fases](./docs/10-plan-fases.md) y en la [deuda técnica](./docs/11-deuda-tecnica-pendiente.md).

## Un Cherry por país

Cherry no es una app global con un único servidor. Cada país (o región, o comunidad) puede tener **su propio Cherry**, montado y gestionado por gente de allí, que cumple la ley de su país.

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/countries-dark.png">
  <img src="./docs/assets/countries-light.png" width="100%" alt="Cherry España, de Akorda Software, en preparación. Al lado, huecos para Cherry Portugal, Cherry Francia y cualquier otro país que alguien quiera montar.">
</picture>
</div>

- **Cherry España** es la instancia de [Akorda Software](https://github.com/akorda-software), en preparación.
- ¿Quieres montar Cherry en otro sitio? Puedes usar el código, el nombre, el logo y la mascota siempre que cumplas unas [condiciones mínimas](./TRADEMARKS.md): código abierto, comprobar la edad de verdad, moderación y nada de vender datos.

Las personas de una instancia solo ven a las de esa misma instancia. Para una app de citas tiene sentido: la gente que te interesa conocer vive cerca.

## Cómo está hecho

| Parte | Tecnología |
|---|---|
| [`apps/mobile`](./apps/mobile) | Expo SDK 54 (React Native, Expo Router) y un módulo nativo propio para leer el chip del DNI |
| [`apps/backend`](./apps/backend) | Elixir y Phoenix: API REST, chat por WebSocket, fotos y verificación de documentos |
| Base de datos | PostgreSQL 18 con PostGIS |
| [`packages/contracts`](./packages/contracts) | Tipos compartidos entre la app y el servidor |
| [`packages/mobile-shared`](./packages/mobile-shared) | Clientes de la API y utilidades de la app |
| [`docs/`](./docs/README.md) | Documentación: producto, arquitectura, API, cumplimiento legal y despliegue |

## Arrancarlo en tu ordenador

Requisitos: Node 24 y pnpm 10, Elixir 1.18 con OTP 28 y Docker. Las versiones exactas están en [`.tool-versions`](./.tool-versions).

```bash
pnpm install

# 1. PostgreSQL 18 + PostGIS en localhost:5510
docker compose -f infra/docker-compose.yml up postgres -d

# 2. Backend: variables, base de datos y datos de demo
cd apps/backend
cp .env.example .env
mix setup
mix run priv/repo/demo_seeds.exs     # opcional: ~55 perfiles de demo
mix phx.server                       # http://localhost:4000
cd ../..

# 3. App
cp apps/mobile/.env.example apps/mobile/.env
pnpm --dir apps/mobile start         # pulsa «w» para abrirla en el navegador
```

En desarrollo, la bienvenida muestra la caja «Solo en desarrollo»:

- **«Entrar como Lucía (demo)»** (`demo@cherry.dev`): gente en el feed, likes recibidos, matches y conversaciones (necesita `demo_seeds.exs`).
- **«Entrar como usuario nuevo»**: una cuenta limpia para recorrer el onboarding.

El login con Google y Apple y la lectura del DNI por NFC necesitan un build nativo en un móvil de verdad: lo explica [`apps/mobile/README.md`](./apps/mobile/README.md).

### Pruebas

```bash
pnpm test:mobile       # typecheck + mobile-shared + app + contracts
pnpm test:contracts    # solo contracts

cd apps/backend && TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/cherry_test mix test
```

La estrategia de pruebas y sus huecos están en [`docs/09-estrategia-pruebas.md`](./docs/09-estrategia-pruebas.md).

## Montar tu instancia

[`docs/12-self-hosting.md`](./docs/12-self-hosting.md) explica todo lo necesario:

- la imagen Docker o la release;
- todas las variables de entorno;
- la base de datos, las fotos y el proxy con TLS;
- los clientes de Google y Apple;
- cómo compilar la app contra tu servidor;
- qué adaptar para montarlo en otro país.

## Contribuir

Toda ayuda es bienvenida: código, diseño, textos, pruebas o ideas. No hace falta ceder ningún derecho, solo firmar los commits con `git commit -s`. Lo explica [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Documentación

Empieza por [`docs/README.md`](./docs/README.md). El brief de producto está en [`PRODUCT.md`](./PRODUCT.md), las decisiones en [`docs/decisions.md`](./docs/decisions.md) y el cumplimiento legal en [`docs/compliance/`](./docs/compliance).

## Licencia

Cherry es software libre: [AGPL-3.0](./LICENSE) con un [permiso adicional para publicarlo en las tiendas de apps](./LICENSE-EXCEPTION.md). Puedes usarlo, estudiarlo, modificarlo y montar tu propia instancia; si ofreces una versión modificada, también a través de la red, tienes que ofrecer su código.

- **Dibujos** (logo, mascota, ilustraciones) y **documentación**: también [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es).
- **Nombre**: puedes llamar «Cherry» a tu instancia si cumples unas condiciones mínimas ([`TRADEMARKS.md`](./TRADEMARKS.md)).
- **Contribuir**: sin ceder derechos, solo firmando tus commits con el DCO ([`CONTRIBUTING.md`](./CONTRIBUTING.md)).

Detalle en [`COPYRIGHT.md`](./COPYRIGHT.md). Copyright © 2026 Akorda Software y las personas que contribuyen a Cherry.

---

<details>
<summary><b>In English</b></summary>

Cherry is an open-source, self-hostable dating app built to serve people rather than exploit them: no paywalls, no fake scarcity, no ads, no engagement tricks. Every account proves it belongs to a real adult (Spanish ID card read over NFC, or a selfie with a verification provider), and each document can back only one account.

Cherry is meant to run as **one instance per country**, each one run by local people under local law. The official instance is Cherry España, run by Akorda Software. Anyone can run Cherry elsewhere and use its name and artwork under a few [minimum conditions](./TRADEMARKS.md). The app is in Spanish for now; translations are welcome.

License: [AGPL-3.0](./LICENSE) with an [app store additional permission](./LICENSE-EXCEPTION.md); artwork and docs also under CC BY-SA 4.0. Contributions use the [DCO](./DCO), no CLA. Status: under construction.

</details>

---

<div align="center">
<img src="./docs/assets/mochi-wink.svg" alt="" height="72">

<sub>Hecho en España por <a href="https://github.com/akorda-software">Akorda Software</a> y las personas que contribuyen a Cherry.</sub>
</div>
