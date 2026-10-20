# RAT e inventario de proveedores

**17-10-2026 · borrador para aprobación de Albert, no contratos firmados.**
Contacto: `[CORREO_CHERRY]`; representante/DPD: `[DECISIÓN MOTIVADA PENDIENTE]`.
Interesados: usuarios adultos, solicitantes sin cuenta, personal autorizado y
personas mencionadas en avisos. No se prevé atender menores como usuarios.

## Registro de actividades — art. 30 RGPD

Las bases de esta tabla son **propuestas**, no una afirmación de licitud ya
validada. Una base del art. 6 no sustituye una condición del art. 9 o habilitación
del art. 10. Los plazos vigentes y sus carencias están en `14`.

| Actividad / finalidad | Categorías de datos / origen | Base propuesta | Destinatarios y medidas |
|---|---|---|---|
| Alta, acceso y sesiones | Email, nombre, identificadores OAuth, instalación/plataforma, sesiones; usuario y Google/Apple | 6.1.b, seguridad específica 6.1.f ponderada | Backend propio, proveedor OAuth independiente según función; tokens separados/revocables, sin contraseña del proveedor |
| Perfil y compatibilidad | Fecha de nacimiento, género, intenciones, preferencias, etiquetas/bloqueos, bio, fotos; usuario | 6.1.a para finalidad sensible + 9.2.a propuesto, **validar 9.1 LOPDGDD**; 6.1.b solo en elementos no sensibles estrictamente necesarios | Usuarios autorizados según filtros; R2 privado, URLs 300 s, retirada/borrado; no IA/publicidad |
| Proximidad | Punto redondeado a ~500 m y fecha; móvil tras permiso | Determinar 6.1.a/6.1.b según necesidad y alternativas; no dar el permiso OS por consentimiento | Backend, distancias aproximadas a usuarios; no seguimiento en segundo plano; evaluar inferencia local |
| Interacción y mensajería | Likes/dislikes, matches, texto y lecturas; participantes | 6.1.b y condición art. 9 si se revela información sensible, acotada al servicio solicitado | Participantes; cifrado en BD, no E2EE, bloqueo/desconexión; no visor de chats en backoffice |
| Edad y unicidad | Resultado, país/tipo, fechas y HMAC documental; NFC del usuario | 6.1.f propuesto con LIA, no invocar obligación documental universal. Tratamiento biométrico futuro requiere análisis distinto | Backend propio; número/copia documental no persistidos, límites de intentos; NFC no acredita posesión legítima |
| Push | Token, plataforma, instalación y evento mínimo | Servicio solicitado, permisos y base exacta a validar; no marketing | Expo y APNs/FCM si se usa, comprobar payload/región/retención; revocable |
| Reportes y reclamaciones | Relato, cuentas implicadas, categoría, motivos, avisos, recursos y notas internas del equipo | 6.1.b/6.1.f según finalidad y LIA; categorías especiales/penales requieren habilitación adicional | Equipo por rol, afectados con respuesta minimizada; sin revelar denunciante; notas solo internas; medida ajena mínima tras baja |
| Derechos de privacidad | Solicitud, identidad/representación proporcionada, actuaciones y respuesta | 6.1.c, arts. 12–22; 9/10 si procede con habilitación concreta | Titular/rol privacidad, entrega segura y terceros protegidos; sin DNI rutinario |
| Administración del equipo | Email, rol, password hash, sesiones, intentos limitados y auditoría | Relación organizativa y 6.1.f ponderado; obligaciones de confidencialidad | Titular/superadmin; cuentas nominativas, no privilegios inferidos del correo OAuth, revocación y CSRF/TLS |
| Seguridad y operación | Logs mínimos, IP técnica cuando figure, errores/estado, alertas | 6.1.f con minimización y plazo aprobado | Sistemas propios y Telegram para alerta mínima; inventario real de proxy/recolectores aún pendiente |
| Copias y recuperación | Snapshot BD cifrado, no fotos; diario | Misma finalidad de continuidad/seguridad, no archivo histórico ni base nueva para reutilizar sensibles | R2 UE, age privado solo titular; 7 días, restauración aislada con bajas reaplicadas |
| Bajas y limpieza | UUID de cuentas/fotos y referencias técnicas sin email/DNI/relatos | Ejecución de baja y seguridad; 6.1.c/f concretar, no llamar anónimo | Outbox + registro externo UE; acuse y GC condicionado, no reaparecer tras rollback |

## Encargados, responsables y transferencias

| Servicio real / previsto | Función y estado | Documentos y comprobaciones por cerrar |
|---|---|---|
| Infraestructura propia España | Activa: backend y PostgreSQL; responsable Albert, no tratarse a sí mismo como encargado externo | Ubicación, administradores reales, accesos, proxy/logs, medidas y contingencias |
| Cloudflare R2 / proxy si corresponde | Activo, buckets privados UE de fotos, backups y registro | Entidad contractual real, DPA art. 28 si aplica, subencargados, SCC/adecuación y TIA si procede, soporte/accesos fuera UE, borrado y retenciones. Jurisdicción UE no prueba ausencia de transferencias |
| Google y Apple OAuth | Implementación parcial según plataforma; OAuth completo pendiente | Qué endpoints/datos se usan, roles por finalidad, términos/políticas, destinatarios y transferencias; no decir automáticamente «encargados» |
| Expo + APNs/FCM | Código push disponible; actividad efectiva y payload pendientes de verificar | Tokens, contenido de notificaciones, región, retención y eliminación; minimizar texto de mensajes y visibilidad en pantalla bloqueada |
| Telegram | Canal técnico de alertas configurado; entrega real todavía no acreditada | No incluir perfiles, chats, correos ni secretos; metadatos técnicos y cuentas del personal pueden seguir siendo personales. Valorar garantías y alternativa si procede |
| Didit | **Desactivado en producción**, no habilitar en este lote | Antes de activar: entidad, contrato/roles, regiones, biometría, consentimiento/habilitación, retención propia, sesiones abandonadas y prueba de borrado; no afirmar cobertura de sesiones históricas desconocidas |
| Moderación de fotos, bots, IA | **No seleccionado/activado** | Evaluar necesidad, accesos y contratos antes de enviar fotos reales; no copiar los de AudiblePort/Kaselles |
| GitHub y tiendas | Código público/distribución futura, no repositorio de datos de usuarios | Prohibir datos/secretos en issues, artefactos y commits; formularios de tienda coherentes; cuentas de desarrollador y finalidad propia separadas |

## Ficha a completar por cada proveedor

`[ENTIDAD, PAÍS, CONTACTO]` · función/rol por finalidad · categorías/datos mínimos
· contrato y versión/fecha · subencargados/enlace y avisos · región efectiva y
accesos remotos · mecanismo capítulo V y evaluación adicional cuando proceda ·
retención/borrado (incluidas copias) · asistencia a derechos y brechas · reversión
o salida · dueño de revisión · evidencia sin secretos · fecha próxima revisión.

No se firma un DPA por generar esta ficha; no se toma una URL de marketing como
prueba de contrato aplicable. Verificar primero las cuentas y contratos reales.
