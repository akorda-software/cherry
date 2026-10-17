# Fotos privadas y recuperación — 2026-10-17

Autorizado: producción, fotos privadas R2 con enlaces de lectura temporales;
copias completas diarias cifradas de PostgreSQL, siete días, sin fotos; protección
externa frente a restaurar bajas. No compilar/publicar móvil, no cambiar firewall,
no reactivar deploy CI. Preservar `.expo/devices.json` y trabajo ajeno.

001 Fotos: implementación, pruebas, bucket UE privado, traslado de dos objetos,
retirada del acceso local público, validación firmada/no firmada.

002 Recuperación: registro externo de bajas de cuenta/foto antes de confirmar;
backup cifrado independiente diario; limpieza verificada y recuperación aislada
que reaplica todos los registros, invalida sesiones y reconcilia fotos sin
borrado masivo. Pruebas focales y un ensayo integrado antes de activar producción.

Inventario inicial (antes del corte): producción `fd9ce10`, app Dokploy NiPoGi
`liMDfwUHpDKUNnV5B0lW2`, almacenamiento **local**, una cuenta y dos fotos activas.
Sin credenciales/buckets Cherry en R2; PostgreSQL 17.11 en `cherry-db`, sin timer
de backup Cherry. Infra referencia en bare repo `~/dev/akorda-infra.git`.

Inicialmente, cambios aprobados de backoffice/borrado aún sin commit. Backoffice debe
seguir desactivado en producción. Presupuesto: dos objetivos y un ensayo de
recuperación, sin ampliar a jurídico, moderación, HA ni móvil nativo.

Hito 10:58 UTC: implementación y pruebas locales terminadas. 754 backend,
979 móvil, 54 mobile-shared, 29 contratos, seis backups; typechecks, formato,
compilación warnings-as-errors correctos. R2 real: tres buckets UE privados,
cuatro tokens limitados por bucket fuera de Git; dos fotos trasladadas en staging
con las mismas claves. GET sin firma 400 (rechazado), firmado 206, caducado 403;
PUT condicional, HEAD/range, promoción y borrado comprobados con Cherry real.

Primera copia cifrada real de la BD publicada y leída/verificada. Restauración
aislada desde R2 + age + PostgreSQL + migraciones + registro externo realizada:
una cuenta y dos fotos conservadas, cero sesiones/credenciales/jobs. DB/ciphertext
del ensayo eliminados. Clave privada solo Olares, pública solo cherry-db.

**Cerrado 2026-10-17.** Código `d1a022d`, ajuste de contexto Docker/CSS `c008473`;
CI 39027167214 correcto, imagen `c0084736b734f2e31ea820f7a192d7c577eee3ea`
desplegada por NiPoGi, deploy `hvlN93QbxGTGZ0qYuEWTY` done, Swarm 1/1 y
health/readiness públicos 200. Dos fotos privadas verificadas; URLs locales 404,
purga por archivo y originales retirados. Bind vacío conservado. Backoffice
desactivado, staff 0, tareas 0, cuenta 1/fotos 2. Registro real probado con UUID
sintético inexistente y acuse; objetos de prueba retirados. Inventario R2 real 2.

Copia protegida 11:08:23 UTC, cifrada/verificada; copia transitoria preprotección
retirada. Tres timers activos y servicios backup/prune/check success; GC seguro
habilitado. Tres buckets confirmados eu, r2.dev apagado, sin dominios; tokens
rechazan otros buckets. Telegram existente validado por lecturas, sin prueba de
envío. No cambios de firewall/DNS/OAuth, no móviles compilados/publicados,
auto-deploy CI sigue apagado. `.expo/devices.json` ajeno intacto.

Pendientes ajenos a estos objetivos: copia offline adicional de la identidad age
por el titular, revisión legal/consentimientos/contactos, moderación y operación
real del equipo, pruebas nativas y recuperación física completa. Paquete privado
de recuperación en Olares `~/.config/cherry-recovery/` (0700/0600); nada en Git.
