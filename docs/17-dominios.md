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

**Preparación local; no migrado ni desplegado.** En la comprobación inicial ambos
hosts nuevos carecían de A/AAAA resoluble desde Olares. Capacidades de secretos y
SSH administrativo desactivadas; no se ha consultado la zona privada de Cloudflare
ni aplicado DNS, Caddy o Dokploy. El servicio vigente sigue en `cherry.akorda.es`.

Validación local: **782 pruebas backend, cero fallos**, incluidas separación de
hosts, rechazo de cabeceras reenviadas, API/WebSocket bloqueados en `admin`, login
con CSRF auténtico y cookie sin `Domain`. No sustituye la prueba HTTPS de los
dominios reales ni acredita la migración. Sin cambios de código móvil.

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

## Aplicación pendiente

1. Comprobar zona DNS autoritativa y registros existentes. Si la zona está
   gestionada en Cloudflare y la credencial permite esa zona, crear **solo** los
   CNAME de apex y `admin` hacia `home.akorda.es`, con proxy y Full (strict).
   No copiar la IP WAN dinámica ni modificar correo, NS u otros registros. Si
   faltan acceso/delegación/certificados, documentar el bloqueo, no sustituirlos.
2. Leer y respaldar la configuración vigente de Caddy y los dominios/env de esta
   aplicación en Dokploy, sin volcar secretos ni restaurar configuraciones
   históricas globales. Añadir ambos dominios a la app existente, puerto interno
   4000, HTTP en Traefik: TLS continúa terminando en Caddy/Cloudflare.
3. Añadir los bloques Caddy `cherry.org.es` y `admin.cherry.org.es` hacia
   `192.168.0.126:80`. Validar y recargar Caddy; verificar emisión de certificados
   y TLS público. No cambia origen/destino/puerto del salto DMZ → backend y no
   requiere una nueva política de firewall.
4. Publicar/desplegar backend con esta frontera y configurar, preservando todas
   las demás variables y secretos:

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
5. Una vez el destino nuevo esté sano, redirigir **solo la web** del dominio
   antiguo al apex nuevo. Preservar sin redirección `/api`, `/api/*`, `/socket`,
   `/socket/*`, `/uploads`, `/uploads/*` y sondas/métricas técnicas necesarias.
   `/backoffice` y sus descendientes deben dar 404 también en el antiguo; no
   remitir formularios, códigos, cookies o parámetros de invitación al nuevo.
6. Actualizar el paquete privado de recuperación y la documentación canónica
   `akorda-infra` con la configuración realmente aplicada y su reversión
   acotada. No registrar secretos ni atribuir pruebas no ejecutadas.

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
