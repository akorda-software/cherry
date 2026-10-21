# Borrado de cuentas y web pública

Lote del 2026-10-16, ampliado el 2026-10-17 con medidas ajenas mínimas y
recuperación protegida. **Backend publicado el 2026-10-17 en `c008473`; móvil
sin compilar/distribuir.** La política autorizada borra cuenta/correo/OAuth/huella
y permite repetir el mismo DNI. Sin purga masiva de registros anteriores ni
declaración de cierre jurídico; backoffice continúa desactivado.

## Qué hace el borrado

`DELETE /api/me/account` conserva `{ok: true}` y funciona antes del onboarding y durante una suspensión. `Accounts.Erasure` borra en una transacción la cuenta y sus datos vinculados: perfil, ubicación, preferencias, fotos/metadatos/intents, etiquetas, swipes, matches, conversaciones/mensajes, bloqueos/reportes, identidades, verificaciones/intentos, dispositivos, sesiones y tokens. Elimina analítica y jobs de notificación/broadcast asociados antes de perder sus referencias.

La migración `20261016120000` hace cascada también sobre expedientes en los que es solicitante/afectado, sus descendientes, avisos y auditoría vinculada. No deja el relato intacto con una FK a `NULL`. Las conversaciones compartidas se eliminan para las dos personas; no se borran las cuentas ni otros datos independientes de sus interlocutores.

### Medidas sobre otras cuentas — separación aprobada e implementada el 2026-10-17

El titular ha aprobado separar la medida sobre otra cuenta sin conservar datos de quien se borra. Si A denuncia a B, el equipo suspende a B y A pide borrado, `Casework.Erasure` crea una ficha **nueva** `kind: measure` vinculada exclusivamente a B, traslada la referencia de su suspensión y elimina el expediente original, sus descendientes, textos, avisos y auditoría. No conserva enlaces a la denuncia anterior ni identidad, correo, relato, categoría detallada o respuestas que puedan identificar a A.

- **Mínimo conservado:** B, medida/estado, fecha de decisión y cuenta del personal que la decidió para exigir revisión por otra persona; texto explicativo fijo y categoría genérica de seguridad. No copia evidencia ni motivos en texto libre. La auditoría nueva no enlaza al expediente ni a la persona borrados.
- **Sin decisiones automáticas:** no cambia `suspended_at`, no levanta ni vuelve a imponer la suspensión y no altera visibilidad. No interpreta que la desaparición de evidencia confirme o revoque una sanción. La ficha advierte al equipo de esos límites.
- **Recurso utilizable:** aparece en el buzón/API y en el panel. Quien tomó la decisión no puede resolver su recurso; una revisión humana favorable restaura la cuenta si esa medida sigue vigente.
- **Recursos ya presentados:** se trasladan a registros nuevos y mínimos, retirando texto anterior y mensajes libres. Un recurso pendiente mantiene fecha y asignación; no se pierde ni se duplica. Uno resuelto conserva solo resultado, fecha y decisor, sin reiniciar el cupo de revisión. No se inventa su contenido.
- **Borrado de B:** elimina también esa ficha, sus revisiones y sus avisos/auditoría. No crea una lista negra de B ni retiene datos de A. Las medidas ya revocadas no generan fichas nuevas por borrar A.
- **Concurrencia:** `Lifecycle` usa un advisory lock transaccional compartido para recepción/revisión y exclusivo para el tramo de borrado en BD. Las operaciones ordinarias pueden coexistir; el borrado obtiene un grafo estable que incluye descendientes y no puede perder una suspensión/recurso que se confirme a la vez. No se mantiene ese lock durante la limpieza externa posterior al commit.

La migración `20261017100000` incorpora el tipo `measure`. Revertirla se niega a descartar silenciosamente fichas existentes: antes habría que migrar su vía de revisión. No se han fijado aquí plazos de backups, conservación general o reservas legales; el titular los ha aplazado para el siguiente bloque. Esta separación resuelve el bloqueo técnico detectado, no certifica cumplimiento jurídico.

Al confirmar la transacción se desconectan sockets y se intenta la limpieza externa. La huella del DNI queda libre inmediatamente en BD; volver a registrarse crea una cuenta nueva y exige completar otra vez los requisitos habilitados. Incluso una cuenta suspendida puede borrar y volver: no se mantiene una lista negra de identidad tras la baja.

Si se compone la operación dentro de una transacción mayor, no se borran objetos
ni se difunde una desconexión antes de su commit. Con el registro externo activo,
la **solicitud** ya recibida sobrevive a un rollback: el barrido continúa después
el borrado pedido, en lugar de perderlo por un fallo de SQL o de la respuesta.

## Limpieza externa sin cuentas fantasma

`erasure_tasks` contiene únicamente tipo/referencia del objeto o sesión externa, siguiente intento y momento seguro de finalización. **No contiene cuenta, correo ni DNI/huella.** Son referencias temporales, no datos anónimos ni una excepción indefinida de identidad.

- El almacenamiento elimina tanto la clave definitiva como `pending/`. Los fallos conservan la tarea y se reintentan; una excepción del proveedor no convierte un borrado de BD ya confirmado en un error engañoso de la API.
- Una URL firmada todavía puede recibir una subida. Por eso, además del intento inicial, se repite la eliminación después de su caducidad + cinco minutos. Reencolar no acorta esa ventana ni pierde la fila original.
- Un `complete` iniciado antes de la baja que termina de publicar después detecta la desaparición del perfil y vuelve a programar la limpieza. Un perfil borrado no puede crear nuevos intents desde una struct obsoleta.
- Las sesiones nuevas de Didit se registran en `verification_provider_sessions`. Una decisión final (por consulta de la app o por el webhook de Didit) o la baja traspasa su referencia a limpieza durable; la asociación al usuario se elimina. La limpieza borra primero la ficha de usuario que Didit guarda por `vendor_data` (nombre, fecha de nacimiento, países emisores) y después la sesión con `privacy_erasure`. Un `404` al borrar equivale a ausencia confirmada.
- `ErasureSweeper` revisa hasta 50 tareas por pasada, inicialmente a los diez segundos y cada minuto; bloqueos `SKIP LOCKED` permiten varios nodos. No funciona automáticamente en el sandbox de tests. La tarea se elimina al confirmar la limpieza, una vez cerrada la ventana de firmas.

No se garantiza borrado instantáneo durante una caída del proveedor ni se cambia ahora la moderación de fotos. Tampoco se purgan automáticamente caches/CDN/backups externos o sesiones históricas de proveedor que versiones anteriores no registraban. Esas obligaciones operativas y sus plazos deben cerrarse antes del lanzamiento. No se ha implementado una reserva/bloqueo legal de datos: validar su alcance antes de afirmar que esta política satisface íntegramente la normativa española.

### Copias y fotos privadas (implementación 2026-10-17)

El nuevo circuito de recuperación añade registro
externo previo para cuentas/fotos retiradas e instrucciones técnicas de limpieza;
no contiene correo, identidad OAuth, DNI/huella ni relatos. No es anónimo. Un
fallo del registro impide confirmar la baja (503); la eliminación externa puede
seguir pendiente de reintentos sin conservar la cuenta. La limpieza del registro
requiere acuse, desaparición de todas las copias capaces de recuperar el dato y
comprobación de la BD viva, no una caducidad ciega.

R2 privado conserva objetos sin copia adicional. La BD guarda claves y
referencias sin firma; las respuestas autorizadas generan lecturas de 300 s,
renovables con controles de visibilidad/bloqueo/edad/estado. No se puede impedir
compartir una firma vigente ni conservar una captura/descarga anterior. El móvil
preparado renueva firmas y evita nuevas cachés de fotos en disco; **sin compilar
ni distribuir móvil en este encargo**. La moderación continúa aplazada.

## Landing e información pública

Phoenix sirve `/`, `/privacidad`, `/condiciones`, `/normas`, `/seguridad-infantil`, `/transparencia`, `/contacto` y `/eliminar-cuenta`. Sustituye la página de ejemplo; no añade una nueva aplicación web, framework ni proveedor.

Diseño: el mismo sistema que la app (`apps/mobile/DESIGN.md`): papel de puntos, tinta ciruela, contornos y sombras duras, los rotuladores de `brandPalette` y Rubik local en cinco pesos; Mochi (el logo provisional) va en SVG en línea desde `CherryWeb.Brand`, compartido con el backoffice. La portada se centra en que la app es entera para todo el mundo y se entiende por qué ves a cada persona, con lenguaje no técnico, y lo enseña con piezas de la app (polaroids con etiquetas en común y sello de match, un «carné» con todo lo que cualquiera puede hacer, una nota de por qué te sale alguien, un tablero de etiquetas reales del catálogo que se marcan sin JavaScript, los cuatro pasos en una tira troquelada) e ilustraciones geométricas, sin fotos de usuarios ficticios. El paso de la edad se explica aparte y en grande, porque es el único que pide algo delicado: un documento de mentira tachado dato a dato, con el sello «Borrado» y la pegatina «Mayor de edad» como lo único que sale de él, junto a «No guardamos tu documento. No nos interesa.» y las dos únicas cosas que se comprueban (que eres una persona y no un bot, y que tienes 18 años o más). El texto dice también lo que sí se guarda (que eres mayor de edad, cómo y cuándo se comprobó, y la huella cifrada del documento, ver `compliance/02`): «no guardamos nada» a secas sería falso. La profundidad es de libreta en capas: bajo cada ilustración hay una hoja de un papel distinto (rayada con margen y agujeros de anillas, cuadriculada con borde de tijera dentada, rayada arrancada, milimetrada, de lunares, lisa cosida; debajo de «Hecha por y para la gente», un taco de fichas), que se sale por un borde de la pantalla; encima van las piezas y unas pocas pegatinas en el aire. La altura se dibuja con la sombra dura (cuanto más alta, más separada) y, donde el navegador ata animaciones al scroll, también con la velocidad: las hojas se quedan atrás y las pegatinas se adelantan (paralaje). Las hojas nunca pasan por detrás de una línea de texto: en una columna empiezan bajo él. El movimiento es solo CSS y solo sin «reducir movimiento»: la entrada de la portada (las polaroids caen, el sello, el «escribiendo…» y el mensaje), el paralaje y las entradas atadas al scroll (sello, foco, razones y el documento que se tacha). Nada se repite en bucle, igual que en la app, así que no hace falta interruptor de pausa. Sin JavaScript ni fuentes remotas, scripts de seguimiento ni testimonios/cifras inventados; las únicas cifras son reglas reales del producto (8 etiquetas, 5 bloqueos, rejilla de 500 m). Licencia de fuentes incluida en `priv/static/fonts/OFL.txt`.

Todos los textos están **marcados como provisionales**; no se anuncian descargas ni apertura. `PublicSite` versiona el borrador, no una aceptación del usuario. Faltan datos definitivos del titular/contacto, bases jurídicas, conservación, proveedores y revisión profesional. `INSTANCE_OPERATOR`, `INSTANCE_CONTACT_EMAIL` e `INSTANCE_SOURCE_URL` personalizan la información; no se inventa un titular o correo.

`/eliminar-cuenta` explica la ruta de la app y permite solicitarlo por el correo configurado sin reinstalar ni iniciar sesión. No es un endpoint de borrado anónimo: el operador debe verificar la solicitud antes de actuar. Sin correo real, la página declara que la vía no está operativa; no presentarla como completada en Google Play.

`GET /api/config` entrega URLs absolutas propias para privacidad y condiciones cuando no se han definido `INSTANCE_PRIVACY_URL`/`INSTANCE_TERMS_URL`. La app ya las abre desde Acerca de. URLs externas explícitas conservan prioridad. Esto no añade consentimientos/aceptaciones al onboarding.

## Comprobaciones

Pruebas focales: grafo completo de borrado, conservación de cuentas ajenas, reutilización de correo/huella, baja suspendida sin lista negra, fallo/reintento de archivos y proveedor, firma de subida aún vigente, rollback sin efectos externos y concurrencia real con envío de mensajes. La web prueba acceso público, contacto configurable, borradores, escape HTML y cabeceras/CSP. [Estrategia y límites](./09-estrategia-pruebas.md).
