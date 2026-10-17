# Backoffice, reclamaciones y privacidad

Implementación del 2026-10-16, ampliada el 17 con equipo, borrado, acceso personal
y recordatorios. **Panel activado en producción**, migrado a dominio propio en
`dd45b47`, con un superusuario nominativo y cambio
obligatorio de contraseña temporal antes de acceder a casos/equipo. Verificados
login real, CSRF, cookies seguras, logout y rechazo HTTP/cabecera HTTPS falsificada.
Móvil sin compilar/distribuir. Fotos/bots y cobertura humana independiente siguen
pendientes; no equivale a cumplimiento jurídico ni apertura del servicio.

**Dominio propio activo:** `https://cherry.org.es` para web/API y un host
separado para el equipo. `BACKOFFICE_HOST` restringe el panel
al host administrativo; da 404 en cualquier otro host. Verificados TLS y
login real/CSRF/cookies/logout; API y sockets no se sirven en el host admin.
La API antigua permanece para móviles instalados; no se recompilaron.

## Qué funciona

- Backoffice web en `/backoffice`, dentro de Phoenix y sin compilación móvil. Cola de 50 expedientes por página, prioridad de posibles menores, estados pendiente/resuelto, asignación y reasignación por administración.
- Los nuevos reportes crean un expediente, un justificante y su auditoría en la **misma transacción**. Repetir un reporte abierto conserva la idempotencia anterior. La migración importa los reportes antiguos abiertos; no inventa motivos para las decisiones históricas.
- Revisión del relato y del **texto público actual** del perfil, no una captura histórica. No hay visor de chats, fotos, documentos de identidad ni ubicaciones en el panel.
- Resoluciones humanas motivadas: sin infracción, advertencia o suspensión para reportes; respuesta/denegación para reclamaciones y privacidad. Respuestas distintas para quien reportó y para la persona afectada, sin publicar sus identidades entre sí.
- Buzón móvil en **Ajustes → Buzón y privacidad**, también enlazado desde el onboarding. Admite reclamaciones y solicitudes de acceso, rectificación, supresión, limitación, portabilidad y oposición. El backend no exige perfil, edad verificada ni actividad social habilitada para usarlo.
- Justificante, consulta de estado, respuesta y recurso dentro de Cherry. No se envía correo, push ni información a servicios externos. Las respuestas se consultan en el buzón; no hay entrega externa garantizada.
- Un recurso por persona y decisión de reporte/reclamación. No lo puede resolver la misma cuenta de equipo que decidió el original, ni siquiera siendo administrador. Estimarlo para el afectado revoca la suspensión original si sigue vigente; estimarlo para quien reportó o reclamó abre una nueva revisión sin sanción automática y conserva la decisión anterior.
- Auditoría de altas/bajas/login/logout de equipo y de creación, consulta del detalle, asignación, reasignación y resolución de expedientes. Guarda identificadores y acción, no copias del relato, respuestas, chats ni credenciales. La pantalla muestra los últimos 100 eventos del caso.

## Revisión de implementación (2026-10-16)

Responsabilidades separadas detrás de `Cherry.Casework`: `Intake` (recepción), `Inbox` (lecturas privadas), `Review` (permisos/asignación/transacción de decisión), `Resolution` (efectos del resultado) y `Delivery` (avisos privados transaccionales). `Accounts.Restrictions` es dueño de suspensión/restauración. El controlador web desconecta sockets **después** de la decisión confirmada; no hay dependencia de `CherryWeb` dentro de los módulos de casework. Las comprobaciones de BD no dependen de que la desconexión llegue.

El móvil mantiene las peticiones fuera de la vista: listado/envío en `use-support-inbox`, detalle autoritativo en `use-support-case` y vista de detalle separada. Se reutilizan cliente autenticado, contratos y componentes existentes.

Corregido con regresiones focales:

- HTTPS: conservar esquema/peer originales antes de que `FORCE_SSL` reescriba cabeceras; una cabecera no confiable ya no puede saltarse la allowlist indirectamente.
- Acceso: orden consistente staff → credencial también al salir, limpieza de caducadas acotada al staff bloqueado, validación de directorio 0700 antes de crear códigos y alta inválida sin cambios parciales. Revalidar caducidad después de esperar por un bloqueo.
- Recursos: estimar una reclamación abre una revisión nueva, igual que el recurso de quien reportó, sin reescribir historia ni imponer sanciones automáticas.
- Chat: envío y suspensión serializados sobre las cuentas; un envío que espera una suspensión no la atraviesa usando una autorización antigua.
- Logs: escrituras de relatos, avisos y respuestas sin logging SQL de parámetros, además del filtrado Phoenix; prueba explícita con logger en debug. No cubre por sí solo infraestructura/telemetría ajena.
- Buzón: detalle consultado por ID, no solo la copia de una página anterior; errores de recarga/envío separados y no se ofrece recurso sobre un detalle sin actualizar. Leer un aviso de nuevo preserva su primera fecha de lectura.
- Tests: fixtures de concurrencia sin catálogo global persistente. Se corrigió la contaminación de tres etiquetas de tests detectada en la suite integrada y se eliminaron exclusivamente esas filas propias.

Esta revisión no es una garantía de ausencia absoluta de fallos ni sustituye pruebas visuales/nativas, validación de producción o revisión jurídica. [Pendientes verificables para el cierre](./compliance/10-cierre-cumplimiento.md).

Validación final de la revisión: **702 pruebas backend, 974 móvil, 53 mobile-shared y 29 contracts**; typechecks, compilación backend con `--warnings-as-errors`, formato y diff sin errores. No se ha desplegado ni compilado móvil.

## Acceso del equipo

**Ampliación 17-10-2026:** `Cherry.Backoffice.Security` separa alta inicial y
rotación personal de la autenticación, invitaciones y permisos. El bootstrap
requiere contraseña robusta entregada mediante archivo privado; obliga a
cambiarla en `/backoffice/account` antes de consultar expedientes/equipo.
«Mi acceso» permite cambiar contraseña comprobando la actual y revocando todas
las sesiones/invitaciones; después requiere nuevo login. No se amplían permisos
por parámetros ni se crean cuentas de apoyo ficticias. La cola/detalle añaden un
recordatorio de mes natural para privacidad, no una prórroga automática ni SLA.

En una release, `Cherry.Release.bootstrap_backoffice/0` lee
`CHERRY_BACKOFFICE_EMAIL` y `CHERRY_BACKOFFICE_PASSWORD_FILE` (ruta absoluta,
archivo regular 0600/0400 montado privadamente); no imprime credenciales ni
sobrescribe un propietario activo. Después retirar archivo transitorio del
contenedor/host. No introducir contraseñas en el comando, Git o el chat. La
credencial del titular se entrega fuera del repositorio; no se necesita SSH para
el acceso cotidiano ni para el cambio personal. La cuenta de apoyo se invita
cuando exista otra persona y dirección nominativa reales.

Las cuentas de equipo son **independientes** de `users`, Google y Apple. Ningún correo ni rol del cliente concede privilegios automáticamente. El primer superusuario se provisiona por consola; después puede gestionar el equipo en `/backoffice/team`. No hay registro público de personal.

| Rol | Acceso |
|---|---|
| `moderator` | Reportes, reclamaciones de servicio y sus recursos |
| `privacy` | Solicitudes de privacidad |
| `admin` | Ambos ámbitos; puede recuperar un expediente reasignándoselo |
| `superadmin` | Todo lo anterior y gestión de cuentas, invitaciones y permisos del equipo |

Las operaciones comprueban el rol y el estado **actuales en BD**, no los que lleguen de un formulario ni una struct antigua. Deshabilitar una cuenta revoca sus credenciales y bloquea inmediatamente las operaciones siguientes.

Desde una terminal propia del operador, sobre el entorno deliberadamente seleccionado:

```sh
mix cherry.backoffice grant EMAIL superadmin
mix cherry.backoffice login EMAIL /RUTA/PRIVADA/codigo
mix cherry.backoffice disable EMAIL
```

`EMAIL` y la ruta son marcadores, no valores para copiar literalmente. El directorio privado debe existir con permisos `0700`. `login` crea un archivo nuevo **0600**, sin sobrescribir uno existente y **sin imprimir el código**. El operador lo lee en su propia terminal, lo introduce en `/backoffice/login` y elimina ese archivo concreto. No poner códigos en URLs, argumentos, chats, logs o repositorios. En una release, las mismas operaciones se pueden invocar desde la consola administrativa del nodo mediante `Cherry.Backoffice.Access`; para emitir códigos usar **`issue_login_to_file/2`**, nunca imprimir `issue_login/1`.

Los códigos de recuperación contienen 256 bits aleatorios, caducan en diez minutos, se guardan solo como SHA-256 y se consumen una vez. Emitir otro invalida el código anterior sin usar. Las sesiones independientes caducan a las ocho horas, se almacenan como hashes y se revocan al salir/deshabilitar/cambiar el rol. No hay contraseñas por defecto ni SSO/MFA adicional.

### Invitaciones y acceso ordinario

- Solo el superusuario puede invitar, cambiar roles/estado y restablecer acceso. Las comprobaciones usan el rol actual de BD, no una struct antigua ni parámetros del formulario.
- Cada invitación tiene 256 bits, un uso y 24 horas de validez. Se muestra **solo en la respuesta POST**, con `no-store` y sin código en URL; no se envía correo. El operador la entrega por un canal privado a la persona elegida, que abre `/backoffice/invitation` y elige contraseña. Esto no acredita automáticamente la titularidad de un correo.
- Contraseña de al menos 16 caracteres y máximo 256 bytes, almacenada con PBKDF2-HMAC-SHA256, sal aleatoria y 600.000 iteraciones mediante OTP. No se guarda ni loguea la contraseña en claro. Los miembros del equipo pueden volver a entrar por correo/contraseña sin acceso SSH.
- Cinco fallos por cuenta bloquean temporalmente el acceso por contraseña durante quince minutos; veinte intentos por IP de conexión en quince minutos limitan el hashing. Se usa la IP del peer real y no cabeceras arbitrarias; detrás de un proxy varios accesos pueden compartir ese presupuesto. El acceso de recuperación por código sigue separado.
- Restablecer acceso invalida contraseña/sesiones y emite otra invitación. Cambiar permisos o deshabilitar revoca las credenciales inmediatamente. No se puede degradar/desactivar al último superusuario desde la web sin otro superusuario **activado**; una invitación sin aceptar no basta.
- `Cherry.Backoffice.Team` serializa los cambios de permisos, protege el último superusuario y registra acciones sin secretos. `Access` conserva autenticación y recuperación. No se ha convertido a usuarios de producto en personal del equipo.

## Activación y transporte

- `BACKOFFICE_ENABLED=false` por defecto: todas las rutas del panel devuelven 404.
  Producción lo activa explícitamente desde el 17-10, con un propietario real.
- El panel exige HTTPS aunque `FORCE_SSL` de la app principal esté desactivado: HTTP no reconocido devuelve **426**. Con terminación TLS en proxy, `BACKOFFICE_TRUSTED_PROXY_IPS` admite únicamente las **IP exactas de los peers directos** que controla el operador; solo desde ellos se acepta `X-Forwarded-Proto: https`. Sin lista no se confía en esa cabecera. No configurar la IP de un cliente, rangos amplios ni una cabecera aportada libremente desde Internet. Verificar que el proxy sobrescribe la cabecera y que no puede suplantarse su peer antes de activar.
- Producción: la lista contiene solo el peer exacto que ve la app (una IPv4
  mapeada se normaliza), sin ampliar rangos. Si cambia la red, verificar y
  ajustar deliberadamente; debe fallar cerrada. Las respuestas llevan
  `no-transform` para impedir que el CDN inyecte ocultación de correos o scripts
  incompatibles con la CSP.
- Cookies firmadas, `Secure`, `HttpOnly`, `SameSite=Strict` y ruta `/backoffice`; expiración de servidor, CSRF en todas las mutaciones y renovación de la sesión al entrar. Las respuestas llevan `no-store`, `no-referrer`, `noindex` y CSP sin scripts ni recursos de terceros.
- Los códigos y textos se filtran de los logs de parámetros Phoenix. No se conserva otra copia del body crudo para estas rutas.
- El esquema incluye además `20261017120000` (prueba legal) y
  `20261017121000` (rotación inicial), aplicadas en producción. Activar otro
  entorno requiere todas las migraciones, cuenta nominativa y pruebas de acceso;
  no basta con cambiar el flag.

## Suspensión y recursos

Una suspensión es `users.suspended_at` y `suspension_case_id`, **no un borrado**. Desconecta los sockets; impide la API social, la visibilidad del perfil incluso con match previo, los likes/matches visibles y la mensajería REST/WS. Los jobs de push vuelven a comprobar la autorización y descartan eventos obsoletos. Completar/verificar/reanudar el perfil no evita la restricción. El resumen de actividad de la cuenta restringida devuelve ceros.

La sesión del usuario suspendido sigue siendo válida para consultar su propia cuenta, presentar reportes, usar el buzón, pedir revisión y ejercer privacidad. **Cambio de política solicitado:** borrar una cuenta, también suspendida, elimina identidad/correo/huella y permite volver desde cero. No se conserva una lista negra de identidades. Esto sustituye la regla anterior que retenía la identidad tras una baja durante suspensión y acepta el riesgo de evasión mediante un nuevo registro. [Borrado y límites](./15-borrado-y-web-publica.md).

La revisión no restaura otra medida que haya sustituido a la original ni una cuenta borrada. Recalcula la visibilidad respetando pausa, completitud y verificación de edad. Los datos y mensajes no se borran al suspender ni se resucitan matches caducados. **No retira archivos de fotos ya publicados ni sus cachés**: la moderación/retirada de contenido visual sigue aplazada.

## Límites y siguientes entregables

- **Privacidad:** el panel recibe, clasifica y permite responder solicitudes; no genera exportaciones completas ni ejecuta operaciones por el mero hecho de responder. La baja desde Ajustes sí hace borrado físico y tiene limpieza externa durable. Siguen pendientes otros derechos, conservación de cuentas activas y reservas legales/backups. No se ha añadido un botón de borrado arbitrario de usuarios desde el panel.
- **Legal:** textos completos, identidad/contacto y matriz preparados/publicados,
  con prueba de decisiones implementada. Aprobación y exigencia desactivadas;
  art. 9.1/32 LOPDGDD, EIPD/DPD, contratos y decisiones de conservación requieren
  cierre real. [Implementación](./16-textos-y-consentimiento.md).
- **Operación:** recordatorio de mes natural para privacidad, no SLA ni prórroga
  automática. Procedimientos/plantillas en `compliance/16`; falta adoptarlos y
  ensayarlos con personas disponibles. Un propietario no cubre revisión por otra
  persona. No se creó una cuenta de apoyo ficticia; puede invitarse a alguien real.
- **Auditoría y conservación:** append-only para operaciones ordinarias, no un almacén inmutable frente al administrador de BD. La baja borra expedientes vinculados, descendientes, avisos y auditoría, evitando relatos huérfanos. No existe retención indefinida de la identidad borrada. Los expedientes sin baja siguen necesitando plazos, y los backups/reservas legales necesitan cierre específico.
- **Separación de medidas ajenas (2026-10-17):** aprobada por el titular e implementada. Borrar al denunciante elimina el expediente original, relatos, avisos y auditoría; una suspensión vigente de otra cuenta y su revisión quedan en fichas nuevas mínimas, sin datos ni referencias al denunciante. No cambia la sanción automáticamente ni pierde un recurso pendiente. [Detalle](./15-borrado-y-web-publica.md).
- **Evidencia:** todavía no se capturan mensajes concretos reportados ni evidencias históricas del perfil. No se debe suspender basándose únicamente en el número de reportes ni asumir que una acusación está acreditada.
- **Validación:** pruebas de dominio/HTTP y UI con simulaciones; no se ha hecho una revisión visual con navegador real ni una prueba en Android/iPhone. No se compilaron APK/IPA.
- **Automatización:** sin bots activos. [Estudio acotado](./compliance/11-agentes-en-reclamaciones.md), sin proveedor contratado ni decisiones automáticas habilitadas.

Detalle contractual: [API](./05-backend-api.md), [OpenAPI](../apps/backend/priv/static/openapi.yaml), `packages/contracts/src/casework.ts` y `packages/mobile-shared/src/api/casework-api.ts`. Pendientes globales: [plan](./compliance/09-plan-backoffice.md) y [checklist de cierre](./compliance/10-cierre-cumplimiento.md).
