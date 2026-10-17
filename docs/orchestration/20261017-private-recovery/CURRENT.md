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

Inventario comprobado: producción `fd9ce10`, app Dokploy NiPoGi
`liMDfwUHpDKUNnV5B0lW2`, almacenamiento **local**, una cuenta y dos fotos activas.
Sin credenciales/buckets Cherry en R2; PostgreSQL 17.11 en `cherry-db`, sin timer
de backup Cherry. Infra referencia en bare repo `~/dev/akorda-infra.git`.

Cambios previos aprobados de backoffice/borrado aún sin commit. Backoffice debe
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

Pendiente: publicar código aprobado sin `.expo/devices.json`, esperar CI/GHCR;
cutover breve por Dokploy NiPoGi (sin cambios de firewall ni auto-deploy);
reescribir referencias, retirar/purgar rutas locales, verificar producción;
crear nueva copia con protección activa y retirar la copia transitoria anterior;
activar timers/GC y cerrar documentación con evidencia real. Alertas Telegram
existentes configuradas, validadas por lecturas, sin enviar mensaje de prueba.
