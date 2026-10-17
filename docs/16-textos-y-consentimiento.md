# Textos públicos y decisiones de privacidad

Implementación del 17-10-2026, publicación `2026-10-17.2`. **Preparación técnica,
no aprobación jurídica ni apertura.** Expediente y decisiones pendientes en
[`compliance/12`](compliance/12-expediente-juridico.md) a `16`.

## Responsabilidades

- `Cherry.Legal.Identity`: identidad pública por instancia; no concede privilegios.
- `Cherry.Legal.Documents`: contenido público, sin referencias a controladores o BD.
- `Cherry.Legal.Policy`: publicación exacta, declaraciones y SHA-256 canónico.
- `Cherry.Legal` / `Acceptance`: aceptación transaccional y prueba vinculada a cuenta.
- `RequireLegalAcceptance`: control HTTP; las consultas sociales y WS también
  comprueban elegibilidad cuando se activa, incluidos destinatarios sin aceptación.
- Móvil `features/legal`: dominio de declaraciones, adaptador HTTP y pantalla.
  Reutiliza sesión autenticada, UI existente SDK 54 y borrado; sin dependencias nuevas.

La BD no contiene correo, IP o huella de dispositivo adicionales en la prueba:
UUID de cuenta, versión/digest, texto exacto y fechas de las tres declaraciones.
Una operación transaccional serializada sobre la cuenta evita duplicados y
carrera con la baja. Borrar cuenta elimina también la prueba por FK/cascada;
su compatibilidad jurídica con art. 32 y prueba del consentimiento sigue abierta.

## API

- `GET /api/me/legal`: autenticado, `private, no-store`; `publication` y `status`.
- `POST /api/me/legal`: versión, fingerprint y booleanos **estrictos**
  `termsAccepted`, `sensitiveConsent`, `adulthoodConfirmed`. No se acepta string
  `"true"`, silencio, versión cambiada, publicación incompleta/no aprobada.
- Repetir conserva la primera prueba/fecha. Otra publicación genera prueba nueva;
  no reescribe el texto anterior. Una declaración de edad no prueba verificación.
- `GET /api/bootstrap` incluye `legal` (`required`, `accepted`, `ready`, versión,
  fingerprint). Clientes previos ignoran el campo; no activar el gate sin migración.

Al activar, privacidad/buzón/avisos, lectura propia, bloqueo/reporte, pausa y
borrado siguen accesibles sin aceptar textos nuevos, también para suspendidos.
Las rutas de logout/refresh no cambian. Una retirada se ofrece como **retirar y
borrar**, con confirmación informada y eliminación existente; no es una pausa
que siga tratando datos sensibles indefinidamente. Esa necesidad y libertad de
consentimiento requieren evaluación jurídica, no solo la UI.

## Configuración deliberada

Datos públicos: `INSTANCE_OPERATOR`, `INSTANCE_CONTACT_EMAIL`,
`PUBLIC_LEGAL_ADDRESS`, `PUBLIC_TAX_ID`, `PUBLIC_REGISTRY` (o explicación expresa
de no aplicabilidad). No inventar una inscripción. Los valores de Albert son
propios de esta instancia; no se convierten en defaults para otros operadores.

- `LEGAL_TEXTS_APPROVED=false`: preparación por defecto. Completar identidad no
  aprueba los textos. Aprobar no es certificación de cumplimiento.
- `LEGAL_ENFORCEMENT_ENABLED=false`: gate por defecto apagado; no cortar clientes
  instalados que aún no tienen la pantalla. Activación solo tras revisión,
  distribución compatible y comunicación a existentes.
- La publicación local está redactada para España; no se declara lista para
  aceptar en otro país cambiando solo `INSTANCE_COUNTRY`.

Antes de activar: cerrar arts. 6/9 RGPD y 9.1/32 LOPDGDD, EIPD/DPD, contratos,
retención, derechos y operación; actualizar redacción/versión tras esa revisión.
La futura cooperativa no es hoy responsable. Cambiar identidad cambia el digest;
planificar transición y nueva decisión cuando corresponda, no copiar consentimientos.

## Pruebas y límites

Pruebas de booleans, idempotencia, cambios de publicación/titular, borrado,
permisos HTTP, perfiles destinatarios y pantalla (error/reintento/borrado accesible).
No se compilaron/publicaron móviles ni se ejecutó validación nativa. La pantalla
de consentimiento no da por realizadas portabilidad/limitación/exportaciones.
