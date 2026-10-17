# Fotos

**Estado:** pendiente. Lo que ya existe: las fotos se suben a una **zona de espera no pública** (`pending/`), el servidor verifica el binario y luego las publica (`Cherry.Storage.verify_upload/1` y `publish_upload/1`, llamadas desde `Cherry.Dating.PhotoUploads`). Hay límites de 4 subidas vivas y 20 por hora por perfil. **No hay análisis de contenido.**

## Por qué

- **Apple 1.2** exige filtrar contenido inaceptable; **Google Play** exige un procedimiento ante material de abuso sexual infantil (ver `01`).
- **Apple 1.1.4:** nada de pornografía.
- Las fotos son la vía principal de los perfiles falsos (fotos robadas o generadas con IA).

## Flujo propuesto

La zona de espera ya existente es el punto natural donde enganchar el análisis:

1. Subida → la foto queda **pendiente** y no es visible.
2. **Huella contra material de abuso infantil** (PhotoDNA o Cloudflare). Si coincide: no se publica, se bloquea la cuenta, se conserva la evidencia y se denuncia a las autoridades. **Nadie del equipo la mira** ni se envía a una IA externa (ver `05`).
3. **Clasificación automática:** desnudos, violencia, texto o códigos QR (spam) y, en la primera foto, que salga una cara.
4. Limpia → **publicada**. Dudosa → cola de revisión (agente de IA y, si sigue dudosa, humano). Clara infracción → rechazada con motivo.
5. **Huella perceptual** de cada foto para detectar la misma imagen en varias cuentas (bots, suplantación).
6. **Comparación con la cara verificada** (selfie del onboarding, `02`) al subir fotos nuevas, para frenar el truco de verificarse con la cara propia y luego poner fotos de otra persona.

## Herramientas

| Pieza | Opción | Coste |
|---|---|---|
| Abuso infantil por huella | Microsoft PhotoDNA (hay que solicitarlo) / Cloudflare CSAM Scanning Tool (si las fotos de R2 se sirven por Cloudflare) | Gratis |
| Clasificación de contenido | Azure AI Content Safety, API de imágenes; no confundir con PhotoDNA | Nivel F0: 5.000 imágenes/mes según tarifa pública consultada el 2026-10-16 |
| Clasificación de contenido | Modelo de código abierto en nuestro servidor como primer filtro | Gratis (CPU) |
| Clasificación de contenido | AWS Rekognition (~0,001 $/imagen), Google Vision SafeSearch, Sightengine (2.000 gratis al mes) | De pago, barato |
| Duplicados | Huella perceptual propia | Gratis |
| Comparación de caras | Modelo de código abierto (el mismo de `02`) | Gratis (CPU) |

Para self-hosting, el modelo de código abierto debería funcionar sin servicios externos; los servicios de pago serían opcionales por configuración.

### Microsoft: servicios distintos (verificado el 2026-10-16)

- **PhotoDNA Cloud Service:** gratuito para clientes y desarrolladores que superen la evaluación de elegibilidad. Detecta coincidencias con huellas de material de abuso infantil conocido; no es un clasificador general de desnudos, no verifica edad ni identidad y una ausencia de coincidencia no demuestra que una imagen sea segura. El acceso requiere solicitud y aprobación, no solo una clave de Azure.
- **Azure AI Content Safety:** clasifica contenido sexual, violencia, odio y autolesión en imágenes, con niveles de severidad. Su tarifa pública ofrece **5.000 imágenes al mes en Free/F0**; al agotar el cupo se detiene el uso, sin sobrecostes del propio nivel gratuito. Requiere suscripción Azure y un recurso compatible. Otros recursos de Azure pueden tener costes independientes: no se crearán ni cambiarán planes sin autorización.
- Microsoft indica expresamente que **Content Safety no puede usarse para detectar imágenes ilegales de explotación infantil**. No sustituye a PhotoDNA ni al procedimiento de seguridad infantil. Tampoco garantiza ausencia de falsos positivos/negativos, autenticidad de una foto o cumplimiento de toda nuestra política.
- **No integrar Azure Content Moderator antiguo:** está deprecado y su retirada anunciada es el **15 de marzo de 2027**. Para una integración nueva, evaluar Content Safety.
- La API de clasificación devuelve señales, no una resolución jurídica. Los umbrales y motivos deben estar versionados y los casos dudosos deben poder revisarse. Fallos, timeout o cuota agotada dejan la imagen **pendiente**, no aprobada automáticamente ni rechazada como infracción.
- Enviar fotos a Microsoft introduce un proveedor externo de tratamiento: comprobar región disponible, condiciones, retención y contrato antes de activarlo con datos reales. La integración técnica puede probarse con respuestas simuladas sin enviar fotos de usuarios.

Todavía **no hay recurso Azure configurado, solicitud PhotoDNA acreditada ni integración implementada** en Cherry. Plan de trabajo y dependencias: [09 — Backoffice y cumplimiento](./09-plan-backoffice.md).

## Plan

1. [ ] Estado de moderación en `profile_photos` (pendiente / aprobada / rechazada + motivo).
2. [ ] Worker que analiza la foto en la zona de espera antes de `publish_upload/1`.
3. [ ] Solicitar PhotoDNA o activar la herramienta de Cloudflare; procedimiento de denuncia.
4. [ ] Clasificador de código abierto + adaptador opcional para un servicio externo.
5. [ ] Huella perceptual y detección de duplicados.
6. [ ] Comparación con la cara verificada (depende de `02`).
7. [ ] Mensajes en la app cuando una foto se rechaza (con motivo, ver `05`).

## Fuentes

- [Precios de AWS Rekognition](https://aws.amazon.com/rekognition/pricing/) · [Precios de Sightengine](https://sightengine.com/pricing)
- [Microsoft PhotoDNA: elegibilidad, coste y alcance](https://www.microsoft.com/en-us/photodna/faq)
- [Precios de Azure AI Content Safety](https://azure.microsoft.com/en-us/pricing/details/content-safety/) · [Alcance y límites del servicio](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview)
- [Retirada de Azure Content Moderator](https://learn.microsoft.com/en-us/azure/ai-services/content-moderator/overview)
- [Lo que hacen Match Group y Bumble con las fotos y la verificación](https://www.biometricupdate.com/202602/match-group-extends-facetec-liveness-to-hinge-adds-age-verification-for-uk-oz-users)
