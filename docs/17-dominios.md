# Dominio propio y separación del backoffice

## Decisión y estado · 17 octubre 2026

- `https://cherry.org.es`: landing, textos legales, contacto, baja y API de usuarios.
- `https://admin.cherry.org.es`: únicamente el backoffice del equipo. La raíz
  lleva a `/backoffice` y, sin sesión, a `/backoffice/login`.
- Una sola aplicación Phoenix y la misma BD. No se duplican cuentas, datos ni
  fotos; el subdominio no significa aislamiento de procesos o de la base de datos.
- `cherry.akorda.es` mantiene provisionalmente API y chat para los móviles ya
  instalados. No redirigir peticiones API, OAuth ni WebSockets a otro origen.
- No cambiar correo del titular, flags legales, OAuth, buckets, copias ni
  distribución móvil por este cambio. No añadir `www` ni otros hosts sin necesidad.

**Migrado y desplegado**, autorizado por el titular después de preparar el código.
Imagen `ghcr.io/akorda-software/cherry-backend:dd45b47e722c0109d61c637e7137a6fb4c64ff35`;
[CI 39043457798](https://github.com/akorda-software/cherry/actions/runs/39043457798)
correcta: **782 backend, 985 móvil, 54 compartidas, 29 contratos y seis backups**.
Build publicado; job `deploy` sigue pausado. Despliegue manual NiPoGi
`xQXRnuFtOsF5h1rmq6uai`, `done`, Swarm 1/1 y actualización `completed`.

DNS, TLS público y certificado de origen verificados en ambos hosts; Caddy validado
y recargado sin reiniciar servicios ni cambiar otros sitios. Landing/textos/API
públicos 200; health/readiness con SHA exacto. Login real del titular con CSRF,
rechazo sin token, cookie host-only, cambio inicial obligatorio y logout/revocación
probados **sin cambiar su contraseña**. Panel 404 en apex/antiguo/IP LAN y API/socket
404 en `admin`. La compatibilidad antigua conserva rutas y rechazo de handshake
sin autenticar, sin redirección; no se ensayó una conversación autenticada ni OAuth
real Android/iOS. Sin cambios de código móvil ni compilaciones APK/IPA.

## Separación que aplica el código

`BACKOFFICE_HOST` es opcional para otros operadores. Con
`BACKOFFICE_HOST=admin.cherry.org.es`:

- El panel solo se atiende con ese `Host`, nunca en el apex, el host antiguo, la
  IP LAN o un sufijo parecido. GET y mutaciones en hosts incorrectos devuelven
  **404**, sin redirección de credenciales ni emisión de cookies.
- No se usan `X-Forwarded-Host` ni `Forwarded` como fuente de autorización.
  Caddy/Traefik deben conservar `Host` y mantener su frontera de confianza.
- En el host administrativo se permiten panel, CSS propio (también con digest)
  y `robots.txt` denegando indexación. API, páginas de producto, medios, métricas,
  sondas y WebSockets devuelven 404; las sondas internas siguen con localhost.
- La frontera envuelve la entrada del endpoint: también precede al despacho
  WebSocket de Phoenix y a parsers/sesiones/estáticos. Un plug ordinario después
  de `use Phoenix.Endpoint` no basta para proteger el despacho de sockets.
- HTTPS/proxy de confianza, cuentas staff, CSRF y revocación siguen siendo
  obligatorios. Las cookies staff son host-only, Secure/HttpOnly/Strict y ruta
  `/backoffice`, sin `Domain=.cherry.org.es` compartido.
- No indexar y separar dominios no sustituyen la autenticación ni una revisión
  de seguridad. El panel continúa accesible por Internet mediante login; no se
  ha añadido una restricción VPN ni modificado el firewall.

## Configuración aplicada y runbook

1. Zona Cloudflare activa y inicialmente sin registros. Creados **solo** los
   CNAME de apex y `admin` hacia `home.akorda.es`, con proxy y Full (strict).
   Resolución contrastada en Cloudflare y Google; NS `aiden`/`keira` de Cloudflare.
   No copiar la IP WAN dinámica ni modificar correo, NS u otros registros. Si
   faltan acceso/delegación/certificados, documentar el bloqueo, no sustituirlos.
2. Configuración previa respaldada privadamente, sin volcar secretos ni restaurar
   configuraciones históricas globales. Ambos dominios añadidos a la app existente,
   puerto interno 4000 y HTTP en Traefik. Se mantienen también el antiguo y la IP
   LAN. TLS continúa terminando en Caddy/Cloudflare.
3. Bloque Caddy compartido de los dos nuevos hosts hacia `192.168.0.126:80`.
   Certificados Let's Encrypt válidos hasta el 15 enero 2027, con renovación
   automática de Caddy. No cambia origen/destino/puerto del salto DMZ → backend;
   **no se modificó ningún firewall, NAT ni DNS interno**.
4. Backend publicado/desplegado con esta frontera y valores siguientes,
   preservando todas las demás variables y secretos:

   ```dotenv
   PHX_HOST=cherry.org.es
   PHX_URL_SCHEME=https
   PUBLIC_BASE_URL=https://cherry.org.es
   BACKOFFICE_HOST=admin.cherry.org.es
   INSTANCE_PRIVACY_URL=https://cherry.org.es/privacidad
   INSTANCE_TERMS_URL=https://cherry.org.es/condiciones
   ```

   Mantener `BACKOFFICE_ENABLED=true`, `BACKOFFICE_TRUSTED_PROXY_IPS=10.0.1.3`,
   ambos flags legales en `false`, las audiencias OAuth y R2 privado. Conservar
   CI `deploy` pausado y usar despliegue manual NiPoGi. Verificar el peer real
   si cambia el entorno; no ampliar a una subred por comodidad.
5. Después de verificar destino y acceso real, Caddy redirige **solo las páginas
   públicas y estáticos conocidos** del antiguo al apex nuevo (301). Conserva sin
   redirección `/api`, `/api/*`, `/socket`,
   `/socket/*`, `/uploads`, `/uploads/*` y sondas/métricas técnicas necesarias.
   `/backoffice` y sus descendientes dan 404 también en el antiguo; no
   remitir formularios, códigos, cookies o parámetros de invitación al nuevo.
   Se purgaron exclusivamente las dos URLs CSS antiguas (`site.css` y
   `backoffice.css`) para retirar respuestas 200 en caché anteriores al redirect.
6. Paquete privado de recuperación sincronizado con el entorno vivo y URL del
   archivo privado de acceso actualizada, sin cambiar credenciales. Documentación
   canónica publicada en `akorda-infra`, commit `362a3d8`, con Caddyfile cotejado
   byte a byte contra el host. Snapshot transitorio privado retirado tras comprobar
   que no cambiaron OAuth, otros secretos/variables, dominios previos, build ni
   credenciales de registro. No registrar secretos ni atribuir pruebas no ejecutadas.

### Incidencias acotadas del corte

- La emisión inicial de certificados encontró caché DNS negativa y el borde
  respondió 525 mientras Caddy obtenía los certificados. Convergió con el reintento
  automático, sin bajar TLS estricto ni desactivar verificación.
- El UCG conserva temporalmente caché negativa del apex (SOA de 1800 s; observados
  1105 s restantes). Puede tardar hasta unos 30 minutos desde la consulta antigua
  en resolver en la LAN. Las comprobaciones finales usaron DNS público mediante
  DoH, además de verificar TLS directamente en origen. No se reinició ni alteró el
  resolver global de la red para vaciar esa caché.
- Cloudflare añadía `Allow: /` al robots privado mediante Bot Preference Sync,
  pese a `is_robots_txt_managed=false`. Se cambió **solo**
  `bot_preference_sync_enabled: true → false` en la zona nueva `cherry.org.es`,
  conservando las preferencias/bloqueos AI y todos los demás ajustes. Tras
  propagación, `admin/robots.txt` devuelve exactamente `Disallow: /`, sin el
  `Allow` contradictorio. No se cambió la zona `akorda.es` ni otros dominios.

La futura compilación Android/iOS usará el apex nuevo. No retirar la
compatibilidad antigua hasta distribuirla y comprobar la migración. OAuth y
las consolas de Google/Apple pertenecen al siguiente bloque; no están resueltos
por cambiar URLs en el servidor.

## Criterios de verificación de producción

- Landing, legales y `/api/config` en apex nuevo; health/readiness del backend
  con SHA exacto; API y chat antiguos sin redirección y sin perder datos.
- Panel y su CSS accesibles en `admin`, login real/CSRF/cookies host-only,
  cambio obligatorio de contraseña y revocación sin cambiar por el titular.
- Panel 404 en apex, antiguo e IP LAN, incluso enviando cabeceras reenviadas.
- API, medios y WebSocket inaccesibles desde `admin`; raíz sin bucles y
  `robots.txt`/cabecera noindex. No registrar cookies, códigos ni cuerpos reales.
- TLS válido en los dos nuevos hosts y redirección web antigua sin afectar API.
- Ambos flags legales siguen apagados; ninguna APK/IPA compilada/publicada.

**Reversión:** si el destino nuevo falla, mantener la API antigua y corregir
hacia delante; retirar únicamente los bloques/registros/dominios nuevos si es
necesario. No desplegar una imagen antigua sin fotos privadas/borrado protegido.
Desactivar `BACKOFFICE_HOST` vuelve a exponer el panel en otros hosts: no hacerlo
silenciosamente como rollback; si hay que cerrar el panel, usar
`BACKOFFICE_ENABLED=false` mientras se repara, preservando acceso a la API.
