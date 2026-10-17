# Backoffice y cumplimiento — plan de implementación

**Estado: primer lote interno implementado localmente el 2026-10-16; sin desplegar.** El propietario ha aplazado expresamente las fotos para investigarlas por separado y ha pedido avanzar en lo que no depende de proveedores externos. Están implementados el panel, permisos, expedientes, decisiones, suspensión reversible, buzón, recursos y recepción/gestión de solicitudes de privacidad. [Estado técnico y límites](../14-backoffice.md). Este documento no autoriza cambios de producción, alta de servicios de pago ni el envío de fotos reales a terceros.

La carpeta `compliance/` mezcla investigación y propuestas. Sus afirmaciones legales previas no constituyen una auditoría ni se deben convertir automáticamente en reglas de producto: antes de cerrar el lanzamiento hay que revisar aplicabilidad, excepciones y procedimientos con asesoría jurídica.

## 001 — Expedientes y acceso de administración

Primer bloque propuesto: gestión humana de reportes sobre la base existente, antes de añadir decisiones automatizadas.

**Implementado localmente:** roles independientes, acceso por códigos de un solo uso, cola/asignación/reasignación, decisiones motivadas y auditoría. Sin visor de chats/fotos ni capturas históricas; el perfil mostrado es el actual. Operación/activación pendientes.

- Acceso administrativo separado del usuario normal; autorización comprobada en servidor, permisos mínimos y alta inicial explícita de administradores. No inferir privilegios del correo de Google/Apple ni exponer funciones internas sin controles.
- Panel web en el backend existente, sin requerir compilar APK/IPA. Cola de casos, prioridad de riesgo, asignación, estados y detalle del expediente.
- Motivo de cada resolución, autor, fechas e historial de cambios. Auditoría también del acceso a evidencias sensibles, sin copiar contenido privado o secretos a logs.
- Acciones proporcionadas y reversibles cuando proceda; ninguna sanción solo por el número de reportes. Separar reporte, evidencia, decisión, medida sobre contenido/cuenta y recurso.
- Evidencia acotada al caso. No convertir el panel en un visor indiscriminado de conversaciones privadas: cualquier acceso a mensajes debe tener finalidad, autorización y trazabilidad.

**Cierre:** pruebas de permisos/CSRF/sesiones, acceso denegado a usuarios normales, ciclo completo de un caso, límites de paginación y auditoría. No habilitar públicamente el panel hasta validar el acceso y su operación.

## 002 — Fotos pendientes y adaptadores de moderación

**Aplazado por petición expresa del propietario.** Se abordará al final; otro agente investigará opciones/proveedores. No modificar ahora subida, publicación, almacenamiento o análisis de fotos. No bloquea los lotes internos siguientes.

- Reutilizar la zona privada de subida, pero **no publicar antes de resolver la moderación**. Estados diferenciados de pendiente, aprobada y rechazada; error técnico no equivale a infracción.
- Contrato de proveedor independiente, con simulaciones para tests. Evaluar Azure AI Content Safety F0 para clasificación general y PhotoDNA como integración separada y condicionada a su aprobación (ver `03-fotos.md`). No simular un resultado real de PhotoDNA si no hay acceso.
- Worker con concurrencia, timeout, reintentos y presupuesto acotados; respetar `429` y evitar consumir cupo repetidamente para el mismo objeto inmutable. Cuota agotada/proveedor caído: mantener pendiente y avisar a operación, nunca publicar por defecto.
- La imagen analizada debe ser exactamente la que se publica: identidad/versionado del objeto y verificación de integridad, sin URLs públicas temporales ni acceso arbitrario a URLs aportadas por usuarios.
- Revisar **caducidad y limpieza**: los intents actuales expiran en diez minutos y el barrido tiene cinco minutos de gracia. Una revisión asíncrona/humana no puede depender de ese plazo ni perder su objeto por el sweeper; definir ciclo de vida, expiración y conservación antes de cambiar el flujo.
- Versionar política/umbrales y distinguir las señales del proveedor de la decisión final. Casos dudosos y recursos deben poder gestionarse en el backoffice.
- Actualizar conjuntamente contratos API y estados del móvil. El `complete` actual espera una foto publicada: introducir pendiente requiere compatibilidad y estrategia de activación, no cambiar la respuesta sin adaptar clientes.

**Cierre:** no visibilidad de pendientes en feed/perfil/CDN, publicación idempotente del mismo binario revisado, tests de cuotas/fallos/carreras/borrado y UI de pendiente/rechazo. Los casos de seguridad infantil solo se prueban con fixtures benignos autorizados y respuestas simuladas.

## 003 — Comunicaciones, reclamaciones y recursos

**Implementado el circuito interno:** justificante, estado, respuestas por destinatario y recurso humano con cuenta distinta; disponible también sin completar onboarding. No se envía correo/push. Faltan canales para personas sin sesión/autoridades, política de plazos y cobertura real del equipo.

- Canal de contacto accesible, justificante/identificador y seguimiento del caso, no solo un botón de reportar perfiles.
- Comunicación de recepción y resolución, con información proporcionada a cada destinatario y protección de la identidad del denunciante cuando corresponda.
- Motivos comprensibles, vía de recurso y revisión humana trazable. Gestión de plazos configurada a partir de la matriz jurídica/operativa, no un plazo universal supuesto.
- Diferenciar reclamaciones de moderación, solicitudes de privacidad y comunicaciones de autoridades; permisos y conservación propios.
- Acordar responsables, cobertura y escalado. Implementar una cola no acredita que alguien vaya a atenderla.

**Cierre:** reporte → revisión → decisión → aviso → recurso → nueva resolución, con pruebas de acceso, idempotencia y no revelar datos ajenos.

## 004 — Privacidad y documentación de lanzamiento

**Implementada la recepción y gestión de solicitudes**, separada por permisos. Pendientes ejecución de exportaciones/supresión, conservación/purga, textos/consentimientos versionados y cierre jurídico; responder un expediente no equivale a efectuar esas operaciones.

- Inventario de datos, finalidades, bases jurídicas, proveedores y flujos. Confirmar el titular/operador de la instancia y los contactos públicos antes de redactar textos finales.
- Solicitudes de acceso/exportación, rectificación y supresión: verificar solicitante y permisos, evitar exportar datos de terceros y definir el tratamiento de conversaciones compartidas/evidencias.
- Borrado físico y limpieza externa reintentable implementados en el segundo lote local, sin identidad residual tras la baja. Faltan plazos de cuentas activas, backups y excepciones legales justificadas; no ejecutar borrados masivos incidentales. [Estado](../15-borrado-y-web-publica.md).
- Revisar consentimientos, términos versionados y prueba de aceptación, normas de comunidad, aviso legal y privacidad. La interfaz debe reflejar lo que el sistema hace realmente.
- Evaluar EIPD/DPD y demás obligaciones según actividad y escala, contratos de encargados y procedimientos de incidentes/seguridad infantil. Revisión jurídica antes de declarar cumplimiento.

**Cierre:** matriz de requisitos con fuente, aplicabilidad, responsable, prueba técnica/operativa y estado; validación legal y cuestionarios de tiendas coherentes. No presentar todo este bloque como un problema que resuelve una API de Microsoft.

## Dependencias y límites de esta fase

- Confirmar si el propietario dispone de suscripción Azure y desea usar F0. Las credenciales, si hacen falta, se introducirán fuera del chat y del repositorio. No cambiar a S0 ni crear recursos facturables automáticamente.
- Solicitud y aprobación de PhotoDNA todavía pendientes; la disponibilidad no depende solo de desarrollar un adaptador.
- Activación de proveedores, tratamiento de fotos reales, cambios de retención y despliegues se ejecutarán como pasos explícitos, después de las pruebas locales y las decisiones correspondientes.
- Mantener como restricción vigente: **no compilar/publicar apps móviles** mientras el propietario prepara OAuth Apple/Google para iOS.
