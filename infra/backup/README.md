# Backups y recuperación de Cherry

Política aprobada el 2026-10-17: **una copia completa independiente diaria de
PostgreSQL, cifrada antes de salir, siete días, sin copia de imágenes**. No WAL,
incrementales, mensuales/anuales, réplica ni copia adicional local permanente.
R2 no sustituye el backup de la BD. Esta configuración no certifica cumplimiento
jurídico ni fija excepciones de conservación legal.

## Circuito

- `pg_dump -Fc --no-owner --no-acl`, consistente, por socket local como postgres.
  Se transmite directamente a `age`; **no hay dump en claro en disco**.
- Clave pública age en `cherry-db`; identidad privada fuera de producción, en
  Olares: `~/.config/cherry-recovery/backup-identity.agekey` (0600, directorio
  0700). La clave privada no está en R2 ni en el servidor de BD. Guardar además
  una copia offline bajo control del titular: perderla impide descifrar backups.
- Bucket privado UE `cherry-db-backups-prod`, distinto de
  `cherry-photos-prod` y `cherry-recovery-journal-prod`. Tokens distintos por
  función/bucket; la app no recibe el token de backups. No r2.dev ni dominios
  públicos. Jurisdicción `eu`, no solo preferencia `weur`.
- La clave del objeto contiene el inicio conservador del snapshot. SHA-256 y
  tamaño se verifican **descargando el ciphertext completo** después de subirlo.
  El checksum detecta corrupción; age autentica el contenido al descifrarlo.
- Temporales cifrados en `/run/cherry-backup`, eliminados al terminar/fallar el
  servicio o reiniciar. PUT atómico, sin multipart para estas copias (<4 GiB
  comprimidos); si se supera ese límite se falla/avisa, no se publica una copia
  incompleta. Timeout global 75 minutos, sin mantener la última buena para siempre.
- Diario a las **03:15 UTC**, con hasta cinco minutos de dispersión y ejecución
  persistente al volver de una parada. Hasta aproximadamente 24 horas de cambios
  perdidos si funciona; no hay RPO garantizado si fallan las copias.
- Limpieza **cada quince minutos**, independiente del éxito de la siguiente
  copia: elimina por edad del contenido, comprueba HEAD=404 y vuelve a listar.
  Lifecycle R2 a siete días como segunda defensa; aborta multipart a un día.
  R2 no garantiza el instante exacto de eliminación por lifecycle (normalmente
  hasta 24 horas adicionales); tampoco prometer borrado instantáneo durante
  fallos de proveedor/host o mientras se mantiene el lock de una copia.
- Comprobación horaria: copia <26 h, ninguna caducada y registro externo
  accesible/sin bajas pendientes fuera de su ventana +30 minutos. Un fallo de
  copia, limpieza o comprobación dispara el **canal Telegram de alertas ya
  existente**, sin identidades ni enlaces de fotos en el mensaje. No se añade
  proveedor de observabilidad. Los avisos tampoco llegan si falla Telegram o
  toda la VM: no es un watchdog externo independiente.

## Registro externo antirrestauración

`Cherry.Recovery.Journal` registra **antes de confirmar el borrado**:

- Baja de cuenta: UUID interno y fecha, sin correo, OAuth, DNI, huella ni relato.
- Retirada de foto: UUID de la fila, para impedir recuperarla si R2 no la borró.
- Instrucciones mínimas de limpieza: clave de objeto/ID de sesión externa y
  cierre de ventana de subida. Se separan de la cuenta; permiten reintentar
  también lo que un snapshot antiguo nunca llegó a conocer.

Son datos técnicos personales, **no anónimos**. Solicitudes y acuses se guardan
fuera de PostgreSQL en el bucket privado del registro. Una caída o timeout del
registro no produce `{ok: true}`: la API responde 503. Una solicitud que sí llegó
al registro no se pierde por rollback SQL/caída de la respuesta; el barrido la
continúa. Es una intención durable de borrado, no una transacción distribuida.

El acuse solo se escribe después de aplicar la baja, o de confirmar la limpieza
externa y cerrar las firmas vigentes. Sin acuse se reintenta. La limpieza del
registro requiere **todas** estas condiciones: acuse anterior a todos los
snapshots conservados, al menos siete días desde ese acuse, inventario de copias
correcto y comprobación de ausencia/inactividad en la BD viva. Puede superar los
siete días de la solicitud por reintentos/ventana de firmas. **No tiene un TTL
ciego ni caduca junto con un backup concreto**. No crear snapshots/copias
paralelas fuera de este circuito sin ampliar primero su protección.

Inventario comprobado antes de activarlo: `PGDATA backup=0`, sin snapshots de
VM 102, sin jobs vzdump ni copias en almacenamiento `local` de MS-A2; sin cron,
pgBackRest, archivos dump/SQL ni archivado WAL en cherry-db. El snapshot
`antes-dokploy` de VM 101 es anterior a los datos/fotos actuales y no incluye
PGDATA. No se elimina trabajo ajeno ni backups de otros servicios.

## Instalación y operación

En `cherry-db`: paquetes Debian `age`, `python3-boto3`; scripts
`/usr/local/libexec/cherry-backup.py` y `cherry-backup-alert.py` (root:root, 0755).
Unidades `cherry-backup*` en `/etc/systemd/system`.

- `/etc/cherry-backup/config.json`: raíz 0600; plantilla `config.example.json`.
  `journal_gc_enabled` solo tras inventariar copias y activar el registro en app.
- `/etc/cherry-backup/alerts.json`: raíz 0600, `bot_token` y `chat_id` del canal
  operativo existente. Nunca pegarlos en comandos, documentos o Git.
- En Olares, configuración/credenciales de recuperación en
  `~/.config/cherry-recovery/` (0700/0600). `production.env` debe mantenerse
  actualizado con `MESSAGE_ENCRYPTION_KEY`, huella documental, secretos de sesión
  y configuración externa. No regenerar la clave de mensajes al restaurar.
  Este paquete de secretos **no es una copia de usuarios ni de fotos**.

```sh
sudo -n systemctl start cherry-backup.service
sudo -n /usr/local/libexec/cherry-backup.py status
sudo -n systemctl list-timers 'cherry-backup*' --no-pager
sudo -n journalctl -u cherry-backup.service --no-pager
```

No ejecutar una restauración sobre la BD viva ni modificar firewall para probar.

## Recuperación (servicio cerrado al público)

1. Parar **todos** los escritores y workers de la instancia perdida, y los timers
   de copias/GC durante el ensayo real de recuperación. Usar host/BD aislados,
   sin HTTP/WS público, sin push/Oban ni migrador de arranque sirviendo tráfico.
   Una comprobación de salud 200 no autoriza reabrir.
2. Descargar ciphertext con `cherry-backup.py download --key <daily/...dump.age>
   --output <archivo-nuevo> --config <config-privada>`. Verifica SHA-256.
   Descifrar en pipe: `age --decrypt --identity <identidad-offline> <copia>` →
   `pg_restore --exit-on-error --no-owner --no-acl --dbname <BD-aislada>`.
   Aprovisionar PostgreSQL/PostGIS y propietario antes; no recuperar roles globales
   ni contraseñas históricas del clúster. Nunca guardar el dump en claro.
3. Cargar configuración/clave de mensajes original; apuntar `DATABASE_URL` **solo
   a la BD recuperada**. Aplicar migraciones con `Cherry.Release.migrate()`.
4. Con `CHERRY_ISOLATED_RECOVERY=true`, ejecutar `bin/cherry eval
   'Cherry.Release.recover()'`, que inicia solo Repo/Req, no la aplicación pública.
   Reaplica **todos** los registros conservados, también anteriores al snapshot
   y ya acusados. No filtra por fecha del backup. Recorre paginación completa;
   rechaza listados incompletos/corruptos o registro inaccesible. **Cualquier error
   o tarea externa pendiente impide reabrir**; repetir cuando se resuelva.
5. Invalida sesiones/refresh/push/dispositivos, credenciales/invitaciones del
   personal y jobs restaurados. Comprueba roles, accesos, suspensiones y cambios
   del equipo posteriores al snapshot por revisión humana antes de reabrir.
6. Conserva fotos activas que existan en R2 y retira solo referencias a objetos
   realmente ausentes (404); un 403/timeout detiene la recuperación. Canonicaliza
   referencias de snapshots anteriores a la migración local→R2. No vacía galerías.
7. Tras parar los escritores y esperar el TTL máximo de subida + cinco minutos
   (**quince minutos con la configuración actual**), ejecutar con
   `CHERRY_RECOVERY_UPLOADS_QUIESCED=true` el paso
   `bin/cherry eval 'Cherry.Release.reconcile_storage()'`. Reconsulta el registro,
   inventaría R2 y elimina/verifica **solo** objetos sin asociación activa y zonas
   pendientes. Las fotos válidas permanecen. Fotos subidas después del snapshot
   cuya asociación se perdió no se reconstruyen; deberán subirse de nuevo.
8. Revisar los errores, acceso privado y ausencia de sesiones/bajas restauradas;
   crear una copia nueva protegida; reactivar timers y después el servicio.
   Limpiar BD/ciphertext del ensayo al terminar. No restaurar una copia antigua
   sin estas medidas aunque parezca arrancar correctamente.

La primera prueba real ha verificado descifrado/restauración/migraciones y
conservación de una cuenta/dos fotos disponibles, con cero sesiones, credenciales
y jobs en la BD aislada. Las regresiones sintéticas cubren rollback tras recibo,
bajas anteriores al snapshot, retirada de foto con objeto superviviente, ausencia
de objetos, caída de R2/registro y reingreso con el mismo correo (UUID nuevo).
No se ha provocado una caída de producción ni se ha probado recuperación física
del host completo. Didit está desactivado en producción; no se promete reconciliar
sesiones históricas desconocidas de un proveedor que no fue inventariado.
