# Documentación de Cherry

Documentación de referencia del proyecto. Organizada por temas; cada documento es autocontenido pero remite a los demás cuando conviene.

**Regla canónica:** estos documentos describen **lo implementado hoy**. Lo planificado y no construido vive en `10-plan-fases.md` y `11-deuda-tecnica-pendiente.md`; lo histórico y sustituido, en `decisions.md` (y en el historial de git).

## Índice

| # | Documento | Qué cubre |
|---|-----------|-----------|
| 00 | [Visión y alcance](./00-vision-y-alcance.md) | Qué es Cherry (app de citas open source, gratuita y self-hosteable), principios, qué queda fuera |
| 01 | [Requisitos de producto](./01-requisitos-producto.md) | Reglas de negocio v1: perfil, etiquetas, ranking, likes, matching, chat, safety, anti-abuso |
| 02 | [Arquitectura](./02-arquitectura.md) | Monorepo, contextos Phoenix, estructura móvil, flujos de datos |
| 03 | [Modelo de dominio](./03-modelo-dominio.md) | Entidades, ciclos de vida (perfil, match, sesión) e invariantes |
| 04 | [Modelo de datos](./04-modelo-datos.md) | Esquema PostgreSQL/PostGIS real: tablas, columnas clave, índices |
| 05 | [API del backend](./05-backend-api.md) | Endpoints REST y WebSocket implementados, con reglas de servidor |
| 06 | [Contratos mobile-backend](./06-contratos-mobile-backend.md) | Formatos de payload aceptados: bootstrap, draft, ubicación, discovery, social, fotos, chat WS |
| 07 | [Flujos de usuario](./07-flujos-usuario.md) | Pantallas y recorridos implementados hoy en la app móvil |
| 08 | [Identidad visual](./08-identidad-visual.md) | Sistema de diseño «Libreta kawaii»: tokens, tipografía, movimiento y componentes |
| 09 | [Estrategia de pruebas](./09-estrategia-pruebas.md) | Suites, entorno (PostGIS), mocks y cómo ejecutarlas |
| 10 | [Plan de fases](./10-plan-fases.md) | Fases de entrega con estado real de cada una |
| 11 | [Deuda técnica pendiente](./11-deuda-tecnica-pendiente.md) | Gaps conocidos entre producto, contrato, docs y código |
| 12 | [Monta tu instancia](./12-self-hosting.md) | Self-hosting: imagen, variables obligatorias, BD, fotos, proxy TLS, Google/Apple y compilar la app contra tu servidor |
| — | [Cumplimiento](./compliance/README.md) | Dossier de trabajo legal y de tiendas (edad, fotos, bots, moderación, RGPD, textos legales, costes): investigación, decisiones, plan y estado |
| — | [Decisiones](./decisions.md) | Registro cronológico de decisiones significativas (contexto, decisión, motivación) |
| — | [Progress](./progress.md) | Avance por fases y registro de cambios |
| — | [starter-guide](./starter-guide.md) | Cómo usar el repo como starter para una nueva app (en inglés) |

## Cómo leerlo

- **Nuevo en el proyecto:** `00`, `01` y `02`.
- **Trabajar en el backend:** `03`, `04`, `05`.
- **Trabajar en el móvil:** `06`, `07`, `08`.
- **Retomar el desarrollo:** `10` y `11`.
- **Montar una instancia propia:** `12`.

## Convenciones

- Idioma: español en producto y docs; código e identificadores en inglés.
- Las decisiones significativas se registran en [`decisions.md`](./decisions.md) con fecha y contexto.
- El avance se anota en [`progress.md`](./progress.md).
