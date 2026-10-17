# Cumplimiento legal y de tiendas

**Checklist canónico de cierre:** [10 — Pendientes de cumplimiento y lanzamiento](./10-cierre-cumplimiento.md), revisado el 2026-10-16. Distingue ley, condiciones de tiendas y objetivos internos; las propuestas del dossier no determinan por sí solas aplicabilidad jurídica.

Dossier de trabajo para poder publicar Cherry en App Store y Google Play cumpliendo la ley. Un archivo por frente; en cada uno, **por qué hay que hacerlo, qué hemos decidido, cómo lo construimos y en qué punto está**.

> **Excepción a la regla canónica de `docs/`:** el resto de documentos describen solo lo implementado. Esta carpeta mezcla a propósito investigación, plan y estado, porque es donde se va avanzando poco a poco. Cuando algo se construya, se documenta también en el documento canónico que toque (`01`, `05`, `07`…) y aquí se marca como hecho.

> **No es asesoramiento legal.** Recoge lo investigado (octubre de 2026) para decidir y construir; los textos legales finales y la evaluación de impacto deben pasar por un abogado.

**Actualización 17-10-2026:** textos completos configurables, expediente jurídico,
RAT/proveedores, conservación/bloqueo, riesgos/EIPD/LIA y procedimientos en `12–16`.
La prueba de decisiones y la pantalla móvil están implementadas, con aprobación
y obligatoriedad separadas y desactivadas por defecto. No equivalen a una
aprobación del titular ni jurídica. [Implementación](../16-textos-y-consentimiento.md).

## Contexto que lo condiciona todo

- **Solo España.** La instancia oficial se publica únicamente en el storefront español de ambas tiendas (`PRODUCT.md`, `decisions.md` D-2026-10-09). Quien monte su propia instancia en otro país la adapta a su ley. Esto deja fuera Ofcom (Reino Unido), las leyes de app stores de EE. UU. y los bloqueos 18+ de Apple en Australia, Brasil y Singapur.
- **Sin monetización.** Cualquier coste por usuario pesa mucho; por eso se priorizan las vías gratuitas y se buscan créditos o patrocinio (ver `08`).
- **Hay chat** (texto, tras match), además de fotos y bios: para las tiendas es contenido generado por usuarios (guideline 1.2 de Apple).

## Frentes

| # | Archivo | Qué cubre | Estado |
|---|---------|-----------|--------|
| 01 | [Requisitos de las tiendas](./01-tiendas.md) | Checklist de Apple y Google para una app de citas | Pendiente |
| 02 | [Mayoría de edad](./02-mayoria-de-edad.md) | Verificación 18+: DNI por NFC, proveedor de respaldo, app europea | Prototipo en `feat/dni-nfc` (servidor probado; NFC sin probar con DNI real) |
| 03 | [Fotos](./03-fotos.md) | Moderación automática, abuso infantil por huella, duplicados | Pendiente (hay zona de espera) |
| 04 | [Bots y cuentas falsas](./04-bots-y-cuentas-falsas.md) | Atestación del dispositivo, una persona = una cuenta, señales | Pendiente |
| 05 | [Reportes y moderación](./05-reportes-y-moderacion.md) | Panel, agentes de IA, plazos, avisos, recursos | Panel activado con un titular; cobertura real/revisión independiente, fotos/IA pendientes |
| 06 | [Privacidad y RGPD](./06-privacidad-rgpd.md) | Datos sensibles, EIPD, DPD, encargados, conservación | Recepción/gestión de derechos local; ejecución/política/cierre jurídico pendientes |
| 07 | [Textos legales](./07-textos-legales.md) | Términos, normas de la comunidad, privacidad, aviso legal | Preparados/publicados; aprobación y distribución de consentimiento pendientes |
| 08 | [Costes, proveedores y financiación](./08-financiacion-y-proveedores.md) | Qué es de pago, a quién pedir créditos, forma legal, donaciones | Lista hecha; sin contactar |
| 09 | [Backoffice y cumplimiento: implementación](./09-plan-backoffice.md) | Entregables, pruebas de cierre, dependencias y decisiones legales | Primer lote interno local; fotos aplazadas al final |
| 10 | [Cierre de cumplimiento](./10-cierre-cumplimiento.md) | Lista verificable de pendientes técnicos, operativos, jurídicos y de tiendas | Pendiente de cerrar con el titular y asesoría |
| 11 | [Agentes en reclamaciones](./11-agentes-en-reclamaciones.md) | Estudio de clasificación/asistencia y condiciones para un futuro piloto | Sin implementar, sin proveedor ni decisiones automáticas |
| 12 | [Expediente jurídico](./12-expediente-juridico.md) | Titular, aplicabilidad, aprobación y transición a cooperativa | Preparado; decisiones/aprobación pendientes |
| 13 | [RAT y proveedores](./13-registro-tratamientos-y-proveedores.md) | Actividades, bases propuestas, roles/contratos/transferencias | Preparado; validación contractual pendiente |
| 14 | [Conservación y bloqueo](./14-conservacion-y-bloqueo.md) | Plazos técnicos reales y art. 32 LOPDGDD | Sin archivo legal adicional; bloqueo pendiente de resolver |
| 15 | [Riesgos, EIPD y LIA](./15-riesgos-eipd-y-ponderaciones.md) | Análisis preliminar, necesidad de EIPD/DPD y ponderaciones | No es EIPD ni LIA aprobada |
| 16 | [Procedimientos y plantillas](./16-procedimientos-y-plantillas.md) | Derechos, avisos, recursos, brechas, confidencialidad y simulacros | Preparado; personas/firma/ensayo pendientes |

## Orden de trabajo propuesto

Prioridad acordada el 2026-10-16:

1. **Circuito humano interno** (`09`): backoffice, buzón, decisiones y recursos implementados localmente; falta activación/operación.
2. **Privacidad y textos** (`06`, `07`): ejecución de derechos, conservación, consentimientos y textos versionados; decisiones del titular y revisión jurídica antes de automatizar borrados o declarar cumplimiento.
3. **NFC, anti-abuso y proveedores** (`02`, `04`, `08`): frentes independientes, sin dar por aprobadas integraciones ni crear recursos facturables.
4. **Fotos al final** (`03`), aplazadas expresamente por el propietario mientras investiga opciones con otro agente.
