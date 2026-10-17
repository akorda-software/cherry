# Conservación, supresión y bloqueo

**17-10-2026 · inventario actual y decisiones pendientes, no nuevos plazos activos.**
Mantener la decisión de borrar físicamente sin huella documental residual. No se
crean archivos de retención, backups adicionales ni listas de suspendidos por
redactar esta política. **No equivale a validar esa decisión frente al art. 32.**

| Datos | Inicio / conservación técnica actual | Borrado y límite | Decisión pendiente |
|---|---|---|---|
| Cuenta, email, identidades OAuth | Mientras exista cuenta; no caducidad por inactividad | Borrado físico; misma identidad puede reingresar | Necesidad de revisión de inactividad y reservas jurídicas |
| Perfil/preferencias/tags/ubicación | Cuenta activa y cambios por usuario | Se borran con cuenta; no archivo de coordenadas exactas | Minimización, campos sensibles y base |
| Fotos e intents | Fotos hasta borrado; intents 10 min + gracia técnica actual 5 min | Objeto eliminado con outbox/reintentos; firmas GET 300 s, copias ajenas fuera de control | Moderación/cachés de clientes instalados; no fotos en backups |
| Likes, matches, mensajes y lecturas | Según ciclo de cuenta y funciones; no prometer purga de mensajes por antigüedad inexistente | Borrar cuenta elimina conversaciones compartidas para ambos | Revisión de necesidad/plazos de cuentas activas y efectos en terceros |
| Verificación/documento | HMAC y resultado con cuenta; número/copia no guardados en BD | Huella se elimina, también tras suspensión | LIA, evidencia y proveedores antes de activar |
| Sesiones y push | TTL/configuración de sesiones y dispositivos | Revocación/baja; jobs relacionados se retiran | Comprobar Expo/APNs/FCM y clientes reales |
| Expedientes y auditoría de usuarios | Vinculados a cuentas, sin purga autónoma por edad actualmente | Cascadas; solo medida ajena mínima sin denunciante cuando procede | **No conservar indefinidamente por comodidad**; aprobar plazos por finalidad y automatizar después con alcance explícito |
| Prueba de decisiones legales | Versión, digest, texto y fechas con cuenta | Cascada con la cuenta, sin IP adicional | Obligación probatoria y art. 32; no archivo oculto de consentimientos |
| Staff y auditoría administrativa | Cuentas revocables; credenciales caducadas podadas | Sesiones 8 h; códigos login 10 min, invitación 24 h; throttle 15 min | Plazo de cuentas dadas de baja y auditoría ajena a usuarios, sin purga aprobada |
| Logs proxy, backend, BD/recolectores | Inventario y TTL efectivo no acreditados completamente | Filtros de datos sensibles en app no prueban todos los sistemas | `[PLAZO POR SISTEMA + CONFIGURACIÓN + EVIDENCIA]` antes de apertura |
| Backups BD | Completo diario cifrado; ventana 7 días | Limpieza explícita cada 15 min; lifecycle R2 con demora posible; si fallan copias no conservar última antigua para siempre | Titular guarda clave offline |
| Registro externo de bajas y outbox | Solo referencias mínimas, no anónimas | Acuse + 7 días + desaparición de snapshots inseguros + BD viva verificada; si falla no borrar a ciegas | Supervisar acumulación y disponibilidad; no añadir identidad/relatos |
| Correos de derechos/avisos fuera de app | Bandeja del titular; no están en cascadas SQL | Revisar manualmente, minimizar adjuntos y copias | `[PROVEEDOR_CORREO, PLAZO, CONTROLES Y BORRADO]`; correo propio no acredita proveedor ni retención |

## Punto bloqueante: art. 32 LOPDGDD

El art. 32.1 establece obligación de bloqueo al rectificar/suprimir; el apartado
2 restringe acceso/finalidad a autoridades competentes para responsabilidades y
al plazo de prescripción pertinente; el 3 impide otros usos; el 4 regula copia
segura si no puede bloquearse en el sistema; el 5 atribuye determinadas
excepciones a autoridades de protección de datos. **No autoriza al operador a
declararse exento solo porque prefiera borrado total.**

Antes de apertura, una revisión cualificada debe definir para cada supuesto:

1. Datos estrictamente exigibles, norma, responsabilidad y plazo de prescripción
   concreto, no «todo durante cinco años» por defecto.
2. Si procede reserva segregada: cifrado/clave separada, invisibilidad para
   aplicación y backoffice ordinario, acceso excepcional autorizado/auditado,
   destinatario competente, fecha de destrucción y prueba de integridad.
3. Cómo compatibilizarlo con reingreso desde cero y sin lista de DNI suspendidos;
   los datos bloqueados no se usarían para nuevas decisiones sociales.
4. Derechos de acceso y limitación, órdenes válidas, contenido de terceros y
   posibles categorías especiales/penales; no conservar material ilícito sin
   instrucciones y base específica.
5. Restauración y bajas: ni backups ni el registro técnico son una reserva legal
   válida por sí mismos. No recuperar para el servicio datos bloqueados/borrados.

**Esta reserva no está implementada ni autorizada.** No afirmar «no queda nada en
ningún sistema» o «cumplimiento cerrado». Si la solución requiere cambiar la
política acordada, explicar al titular datos, acceso, plazo y fundamento antes
de implementarla; no crear copias ocultas.

## Revisión y excepciones

Revisar este cuadro al cambiar proveedor, finalidad, tipo de datos, volumen o
responsable, y periódicamente con `[FECHA / RESPONSABLE]`. Toda excepción debe
ser concreta, motivada, acotada, con acceso restringido y fecha de revisión; una
incidencia técnica no convierte una cola temporal en archivo histórico.
