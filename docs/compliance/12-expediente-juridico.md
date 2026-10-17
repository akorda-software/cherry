# Expediente jurídico de la instancia española

**Preparado: 17-10-2026. Estado: propuesta documentada, no dictamen, firma ni autorización de apertura.**
El software permite preparar textos y pruebas; no sustituye al responsable ni a
una revisión profesional, especialmente con datos íntimos. No se declara «RGPD
completo» por existir este expediente. Los campos pendientes son deliberados.

## Titular y decisiones conocidas

- Titular actual: **Albert Alvarez Estelles**, persona física. El nombre,
  domicilio y NIF públicos pueden reutilizarse de la configuración legal de
  AudiblePort/Kaselles por indicación del titular, previa confirmación de vigencia.
  No se trasladan clientes, contratos, términos, proveedores ni bases jurídicas.
- Correo propio de Cherry: el indicado por el titular, mediante
  `INSTANCE_CONTACT_EMAIL`; distinto del correo nominativo de superusuario.
- Cooperativa Akorda valenciana: **futura, no constituida ni responsable actual**.
- Finalidad: citas entre adultos en España; gratuito, sin publicidad,
  suscripciones, venta de datos o entrenamiento de IA; infraestructura propia y
  pocas personas voluntarias. No se presupone actividad económica por recibir
  datos: tampoco se presume exención de toda norma por gratuidad.
- Fuente de verdad del contenido público: `Cherry.Legal.Documents`, publicación
  `2026-10-17.2`. Identidad por entorno, nunca por el correo OAuth de quien entra.
- No abrir hasta completar decisiones jurídicas y operativas, OAuth, fotos y
  validación móvil/tiendas. No hay autorización para contratar ni activar proveedores.

## Matriz de aplicabilidad

| Marco | Valoración provisional | Qué falta acreditar | Evidencia / dueño |
|---|---|---|---|
| RGPD, arts. 2–3 | Aplicable al tratamiento automatizado de usuarios; actividad no doméstica por ofrecer un servicio a otras personas | Identidad, bases, transparencia, minimización, derechos y garantías efectivas | RAT `13`, titular |
| RGPD arts. 6 y 9; LOPDGDD art. 9.1 | Preferencias/perfiles pueden revelar vida u orientación sexual. Propuesta de consentimiento explícito y específico; no aceptación global | **Analizar finalidad principal**: el mero consentimiento no basta si se dirige principalmente a identificar orientación sexual u otras categorías del precepto. No asumir que llamar «compatibilidad» al tratamiento lo resuelve | Asesoría + titular; bloqueo previo a apertura |
| RGPD art. 30.5 | No invocar automáticamente excepción por menos de 250 personas: tratamiento no ocasional y categorías especiales | Aprobar y mantener RAT | `13`, titular |
| RGPD arts. 35–36 | Concurren datos sensibles, selección de perfiles y localización; evaluar EIPD seriamente | Análisis de criterios y EIPD antes de alto riesgo; consulta previa si queda alto riesgo no mitigado | `15`, titular + especialista |
| RGPD art. 37 y LOPDGDD art. 34 | No afirmar que toda app de citas necesita DPD ni que ser pequeña lo excluye | Actividad principal, escala, seguimiento sistemático y supuestos nacionales; resolución motivada | `15`, titular |
| LOPDGDD art. 32 | El texto obliga a bloqueo al rectificar/suprimir, con excepciones de autoridades competentes, no una autoexención del operador | Compatibilidad del borrado físico acordado, datos/plazos concretos y posible reserva segregada. **No resuelto** | `14`, titular + asesoría |
| LSSI arts. 2 y 10 | La gratuidad aislada no determina si hay servicio de sociedad de la información; valorar naturaleza económica y operación real | Documentar alcance. Se facilita aviso de identidad sin venderlo como dictamen de aplicabilidad | Aviso legal + asesoría |
| DSA arts. 2–3 | Distinguir mensajería privada de difusión de perfiles a destinatarios potencialmente indeterminados; posible alojamiento/plataforma si entra en su ámbito | Clasificación del servicio y naturaleza económica; exenciones por tamaño aplicables a artículos concretos, no a todo DSA | Normas, `16`, asesoría |
| DSA arts. 11–12, 14, 16–18 | Si aplica alojamiento: contactos, términos, avisos suficientemente precisos, motivos y sospechas graves según los artículos pertinentes | Recepción real, acuses/decisiones, acceso sin sesión, autoridades, retención estricta y evidencias. El correo no acredita por sí solo todos los requisitos | Titular + operación |
| DSA arts. 19–24 | Examinar exención micro/pequeña del art. 19 y obligaciones no exentas | Si aplica art. 20, recurso al menos seis meses desde decisión; no recortar ese plazo por UI. Evaluar arts. 21–24 y sus excepciones | Titular + asesoría; no imponer informes de gran plataforma por defecto |
| Derechos de consumidores / EULA | Gratuidad no permite renunciar a protección imperativa; distribución de software y servicio son distintos | Revisión de condiciones y cláusulas de tiendas antes de envío | Titular + asesoría |
| AGPL-3.0-only y dependencias | Código abierto, no datos abiertos ni marca libre | Enlace de código correspondiente a lo ejecutado, avisos/licencias, condiciones de derivados | Desarrollo |
| Apple / Google Play | Son requisitos contractuales distintos del cumplimiento legal | OAuth, cuestionarios, UGC, seguridad infantil, borrado, formularios y validación real | Titular + desarrollo; no envío móvil en este lote |

## Publicación y prueba de decisiones

URLs propias: `/aviso-legal`, `/privacidad`, `/condiciones`, `/normas`,
`/seguridad-infantil`, `/cookies`, `/transparencia`, `/contacto`,
`/eliminar-cuenta`. Sin scripts, fuentes remotas ni publicidad.

La app debe mostrar la publicación exacta recibida del servidor y registrar
**tres acciones separadas y inicialmente desmarcadas**: condiciones/normas,
declaración de mayoría de edad (no prueba de verificación) y consentimiento
explícito para el tratamiento sensible especificado. Informar de privacidad no
significa pedir «aceptarla» como autorización para cualquier finalidad.

La prueba conserva cuenta, versión, digest del contenido, texto exacto y fechas
de cada declaración, sin IP ni huella de dispositivo adicional. Se elimina con
la cuenta según la decisión técnica actual; la compatibilidad de esa eliminación
con obligaciones probatorias/bloqueo queda pendiente. No se acepta una versión
cambiada ni publicaciones incompletas/no aprobadas. Los cambios del titular
cambian el digest; no se perpetúa una aceptación al nuevo responsable por silencio.

`LEGAL_TEXTS_APPROVED=true` expresa una aprobación operativa del titular, **no
certificación jurídica**. `LEGAL_ENFORCEMENT_ENABLED=true` es una activación
independiente, solo tras distribución de clientes compatibles y aviso a cuentas
existentes. No activar para dejar sin acceso social a clientes antiguos sin plan.

## Transición a cooperativa

1. Acreditar constitución, razón social completa, NIF, domicilio, registro y
   representante; confirmar fecha real y responsabilidades antes/después.
2. Analizar fundamento de transferencia/cambio de responsable, finalidades y
   contratos: no considerar la intención actual como cesión autorizada.
3. Informar con antelación apropiada, renovar consentimientos cuando corresponda,
   permitir derechos/baja y documentar continuidad de plazos/casos abiertos.
4. Actualizar textos, identidad del entorno, RAT, EIPD/LIA, proveedores, personal,
   cuentas administrativas, dominios/tiendas y contactos. Rotar/revocar accesos.
5. Generar publicación nueva; conservar prueba acotada donde legalmente proceda,
   no copiar todos los usuarios a un archivo del antiguo titular.

## Aprobación pendiente

| Decisión | Responsable | Estado / fecha |
|---|---|---|
| Datos vigentes del titular y contactos atendidos | Albert | [PENDIENTE] |
| Bases arts. 6/9 y art. 9.1 LOPDGDD | Titular + revisión cualificada | [PENDIENTE] |
| Bloqueo, conservación y excepciones por dato | Titular + revisión cualificada | [PENDIENTE] |
| EIPD y decisión sobre DPD | Titular + especialista | [PENDIENTE] |
| Contratos/roles/transferencias de proveedores | Titular | [PENDIENTE] |
| Personas reales, confidencialidad y atención | Titular | [PENDIENTE] |
| Aprobación de textos y fecha de apertura | Titular | [PENDIENTE; no activada por estos documentos] |

## Fuentes oficiales consultadas

Revisión documental 17-10-2026; confirmar texto vigente al aprobar:

- [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- [LOPDGDD consolidada](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673),
  especialmente arts. 5, 9, 30–34; versión consultada actualizada 27-12-2025.
- [LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758), arts. 2 y 10.
- [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj).
- [AEPD: derechos](https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos).
- [AEPD: riesgo/EIPD](https://www.aepd.es/guias/gestion-riesgo-y-evaluacion-impacto-en-tratamientos-datos-personales.pdf).

No se citan proyectos de ley como obligaciones vigentes ni una política de
tienda como si fuera un artículo del RGPD.
