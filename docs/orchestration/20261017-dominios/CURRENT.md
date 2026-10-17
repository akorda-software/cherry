# 20261017 · dominio propio

## Alcance y cierre

001. Separar web/API `cherry.org.es` y equipo `admin.cherry.org.es` en la misma
aplicación; conservar API/socket antiguos y no distribuir móviles. Código y
pruebas completos, commit/push `dd45b47`, 782 pruebas backend y CI `39043457798`
correcta. CI deploy sigue pausado.
002. DNS/TLS/Caddy/Dokploy y despliegue manual autorizados por el titular.
Deploy `xQXRnuFtOsF5h1rmq6uai` done; Swarm completed 1/1, imagen exacta dd45b47.
Verificados host gates, login real/CSRF/cookies host-only/logout y revocación,
sin cambiar contraseña. Una cuenta producto, dos fotos, un staff, cero credenciales
staff tras logout. Paquete de recuperación y URL del archivo del titular actualizados.

## Decisiones y límites

- Solo dos CNAME nuevos hacia home.akorda.es y SSL strict en la nueva zona.
  Sin firewall, NAT, DNS interno ni cambios de otros servicios.
- Caddy conserva exactamente el resto de sitios; copias root 0600 con prefijo
  `/etc/caddy/Caddyfile.before-cherry-domain-20261017-` (prepare/activate/legacy).
  Digest final f8bda9f1c7a24adf162f96a60b4c6b5d25980a4340cd61c5c1da910a0d412b45.
- Web antigua conocida → 301; API/socket/sondas sin redirect, panel 404. Solo dos
  URLs CSS antiguas purgadas de Cloudflare, no una purga de zona.
- Bot Preference Sync añadía Allow / al robots privado. Desactivado solo su
  booleano en zona nueva; demás ajustes y protecciones AI intactos. Propagado,
  robots privado exacto Disallow / verificado.
- Caché DNS negativa temporal en UCG (SOA 1800 s); DNS públicos correctos.
  Pruebas finales por DNS público DoH; no reiniciar el resolver de toda la red.
- Sin OAuth real/nativas/conversación autenticada, sin aprobar textos ni activar
  flags legales, sin compilar/distribuir APK/IPA. `.expo/devices.json` ajeno intacto.

Documentación principal: `docs/17-dominios.md`; infraestructura canónica committed
y pushed en `akorda-infra` `362a3d8`, Caddyfile cotejado byte a byte. Snapshots
transitorios privados retirados tras contrastar que otros secretos/variables,
OAuth, dominios anteriores y ajustes build/registro/AI quedaron intactos.
Lote cerrado: evidencias finales documentadas, sin código ni despliegues
adicionales pendientes. Único cambio ajeno excluido: `.expo/devices.json`.
