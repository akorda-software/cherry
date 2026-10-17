# 20261017 · textos, consentimiento y backoffice

## Alcance

001. Textos públicos completos y configurables, documentación de responsabilidad
proactiva y transición futura de Albert a la cooperativa, todavía no constituida.
002. Aceptación separada de consentimiento explícito, con prueba y baja accesible.
003. Revisar acceso/roles/recuperación del panel, corregir defectos reproducibles,
probar y preparar activación nominativa. No crear una segunda identidad ficticia.

Lote finito: implementación y pruebas focales, una suite integrada al estabilizar.
No compilar/distribuir móviles, modificar OAuth, moderar fotos, cambiar firewall ni
reactivar despliegue CI. Preservar `apps/mobile/.expo/devices.json` ajeno.

## Decisiones y límites

- El titular es Albert, no una cooperativa inexistente. Datos públicos de identidad
  contrastables en AudiblePort/Kaselles; condiciones y proveedores no se copian.
- Los dos correos recibidos se recuperaron mediante sus referencias y se verificó
  su formato sin imprimirlos; ya no hay bloqueo por ese dato.
- Contraseña robusta fuera del repo/chat o alta por invitación de un solo uso; sin
  contraseña compartida predeterminada. Otra cuenta no demuestra independencia humana.
- RGPD arts. 6/9 no intercambiables; art. 9.1 LOPDGDD exige analizar finalidad
  principal. Art. 32 LOPDGDD impone bloqueo: la política de borrado acordada no se
  declara jurídicamente validada ni se modifica para conservar datos silenciosamente.
- Firmas/contratos, EIPD y aplicabilidad necesitan aprobación real del titular y
  revisión cualificada. Los documentos no equivalen a esa aprobación.

## Estado

- 001: textos y expediente `compliance/12–16` preparados/publicados. Titular,
  domicilio/NIF/correo configurados; registro pendiente explícito, sin inventarlo.
- 002: prueba legal exacta, fechas/digest, tres booleanos separados, idempotencia
  y cascada; pantalla móvil y gate preparados, **sin distribución ni activación**.
- 003: propietario nominativo creado; temporal privada en
  `~/.config/cherry-backoffice/operator-login.json` (0700/0600), cambio inicial
  obligatorio y rotación personal/revocación implementadas. No cuenta ficticia de apoyo.
- Correcciones reales: Traefik confía Caddy exacto; peer backend = LB Swarm
  `10.0.1.3` en IPv4 mapeada, no IP Traefik. `no-transform` impide correo
  oculto/script de Cloudflare incompatible con CSP. Telemetría sintética retirada.
- Código `eb82e58`, corrección `4ce5ad0`; CI `39037164818` correcto; deploy manual
  NiPoGi `jy3_WGK2kKafQb-YfV-hf` en done, 1/1 y readiness/health con SHA exacto.
- 773 backend, 985 móvil, 54 compartidas, 29 contratos y seis backups; typechecks,
  formato, compile sin avisos. Tests UI conservan avisos de mocks/act conocidos.
- E2E HTTPS real: login, CSRF auténtico/rechazo sin token, cookies seguras,
  obligación de cambio y logout/revocación; HTTP LAN/cabecera falsificada 426.
  Contraseña del titular no cambiada por el agente; debe elegir la personal.
- Inventario final: una cuenta producto, dos fotos, un staff, cero tareas de
  borrado/credenciales staff. BD de tests comprobada sin filas de cuentas/perfiles,
  pruebas legales o staff. Entorno de recuperación privado sincronizado.
- Canonical infra documentada/pushed en `akorda-infra` `aec7a79`; sin firewall,
  DNS, Caddyfile, OAuth ni distribución móvil. CI deploy permanece pausado.
- Custodia offline de claves a cargo del titular. Próximos bloques OAuth/fotos
  siguen sin abordar. Revisión jurídica, contratos/EIPD, otros derechos y dos
  personas reales siguen pendientes: no lanzamiento ni certificación de cumplimiento.
