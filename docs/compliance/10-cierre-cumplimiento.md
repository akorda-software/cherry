# Pendientes para cerrar cumplimiento y lanzamiento

**Revisado el 2026-10-16. No es un dictamen ni una certificación jurídica.** Alcance acordado: instancia oficial para adultos, sin monetización y publicación en España. Separar obligaciones legales, condiciones contractuales de las tiendas y objetivos de producto. Lo siguiente es un checklist de cierre, no trabajo ya ejecutado ni autorización para contratar, publicar, activar proveedores o borrar datos.

El panel/buzón local cubre recepción, decisiones y recursos. **No demuestra que se hayan ejecutado derechos, que haya personal disponible ni que el servicio cumpla la ley.** Las fotos siguen aplazadas por el titular, no exentas ni resueltas.

## 1. Titular y matriz de aplicabilidad — titular + asesoría

- [ ] Identificar responsable, domicilio/contactos y forma de operación. Validar el alcance de RGPD/LOPDGDD, LSSI y DSA según el servicio real. Ser gratuito, voluntario u open source no elimina por sí solo obligaciones de protección de datos.
- [ ] Distinguir perfiles publicados de comunicaciones privadas y documentar condición de alojamiento/plataforma y exenciones de micro/pequeña empresa. No asumir que la exención de ciertos artículos de plataformas elimina todas las obligaciones de alojamiento.
- [ ] Matriz: requisito → fuente → aplicabilidad/exención razonada → responsable → procedimiento → prueba. Confirmar la normativa nacional vigente de menores; no presentar proyectos de ley como obligaciones ya en vigor.

## 2. Inventario y bases jurídicas — titular + asesoría

- [ ] Registro/inventario de OAuth, perfil/preferencias que pueden revelar orientación sexual, ubicación, fotos, mensajes, verificación/huellas HMAC, dispositivos, expedientes, auditoría, logs, backups y SDK/proveedores.
- [ ] Finalidad y base del art. 6 y, cuando corresponda, condición válida del art. 9 por tratamiento. Evaluar consentimiento explícito, específico y demostrable para orientación sexual; ni el permiso del sistema ni aceptar términos lo sustituyen.
- [ ] Evaluar biometría según el tratamiento y finalidad reales: no todo selfie equivale automáticamente a identificación biométrica unívoca. Una huella HMAC vinculable y ubicación aproximada pueden seguir siendo datos personales; no llamarlas anónimas sin análisis.

## 3. Textos y consentimientos — titular + desarrollo + asesoría

- [ ] Términos/EULA, normas de comunidad, privacidad, identidad/aviso legal y contactos definitivos. Describir las funciones realmente activas, no IA o verificaciones todavía inexistentes.
- [ ] Publicar URLs accesibles y comprobar destinos desde la instancia, la app y las tiendas. **Hay landing y páginas legales locales con borradores y enlaces por defecto desde «Acerca de»**; falta acreditar contenido definitivo, configuración y publicación real.
- [ ] Versionado y prueba de aceptación, separada de consentimientos necesarios: finalidad, versión, fecha, retirada y efecto en tratamientos. Cubrir usuarios existentes y cambios de versión; no bloquear derechos por retirar consentimiento.

## 4. Ejecución de derechos — desarrollo + operación

- [ ] Acceso/copia y portabilidad cuando corresponda, distinguiendo sus alcances y sin divulgar datos de terceros; entrega segura.
- [ ] Rectificación, supresión, limitación y oposición efectivas. Verificación proporcionada del solicitante y representantes; no pedir un DNI por defecto sin necesidad.
- [ ] Canal accesible **sin sesión**, tras borrar cuenta o desinstalar la app. Hay `/contacto` y `/eliminar-cuenta` locales, con enlace al correo solo si se configura `INSTANCE_CONTACT_EMAIL`; falta un contacto atendido y verificado. El buzón no puede ser la única vía.
- [ ] Responsable, seguimiento, respuesta/denegación motivada y reclamación ante autoridad. Regla RGPD: **un mes**, no 30 días universales; hasta dos meses adicionales solo en las condiciones previstas y notificando la prórroga en el primer mes.
- [ ] Acreditar la operación completada; marcar un expediente «respondido» no acredita exportación o borrado. Cierre: simulación extremo a extremo de cada derecho, también sin acceso a la cuenta.

## 5. Conservación y supresión — titular/asesoría decide; desarrollo ejecuta

- [ ] Tabla de plazos, inicio, fundamento y excepciones por dato: cuentas inactivas/borradas, chats compartidos, fotos/cachés, documentos/huellas antifraude, expedientes, auditoría, logs y backups.
- [x] Borrado físico local al pedir la baja, sin esperar al reingreso: cuenta, identidad/correo/huella, datos vinculados y expedientes/relatos/avisos/auditoría. Permite el mismo DNI tras la baja, también suspendida; decisión expresa del propietario, no una conclusión de cumplimiento jurídico.
- [x] Cola local durable de eliminación de archivos/sesiones externas nuevas registradas, con reintentos y limpieza tras caducidad de firmas. Pruebas con datos sintéticos; conversaciones compartidas desaparecen para ambas personas.
- [x] **Separación aprobada el 2026-10-17:** se elimina el expediente del denunciante y se mantiene solo una ficha mínima de la suspensión de la otra cuenta y su revisión, sin datos ni enlaces al denunciante. No levanta/reimpone la sanción; conserva recursos pendientes y exige revisión independiente. Probado con concurrencia real. [Alcance](../15-borrado-y-web-publica.md).
- [ ] Validar el borrado real en proveedores, reconciliación de bajas/sesiones antiguas y alcance/plazos de bloqueo o reserva legal (art. 32 LOPDGDD cuando corresponda). La política implementada no contiene una excepción legal automática. Una sanción no elimina derechos.
- [ ] Cierre operativo de backups/restauración: política aprobada (diario completo,
  cifrado, siete días, sin imágenes), registro externo y recuperación implementados;
  primer descifrado/restauración aislada probado. No promete borrado instantáneo ni cierra reservas legales.

## 6. Riesgo, EIPD y DPD — titular + asesoría de privacidad

- [ ] Evaluación de riesgo y determinación documentada de necesidad de EIPD según tratamientos reales/criterios aplicables. Datos de citas/sensibles, ubicación y posibles biométricos requieren análisis especialmente cuidadoso; ser pequeño no basta para descartarla.
- [ ] Si procede, EIPD antes del tratamiento de alto riesgo y consulta previa si queda alto riesgo no mitigado.
- [ ] Evaluar DPD conforme al art. 37 y legislación nacional: actividad principal y gran escala importan. Designar/comunicar/publicar contacto si procede o justificar no aplicabilidad; no afirmar que toda app de citas lo necesita automáticamente.

## 7. Proveedores y personal — titular + proveedores

- [ ] Inventario real de hosting, almacenamiento/CDN, identidad/verificación, correo/push/telemetría y futuros moderadores de fotos. Determinar roles: no todo OAuth/SDK es automáticamente un encargado.
- [ ] DPA/contratos art. 28 cuando corresponda, subencargados, regiones, conservación, supresión, asistencia en derechos/incidentes y mecanismos/garantías de transferencias internacionales.
- [ ] Didit: cerrar retención/contrato y caducidad de sesiones abandonadas con cuenta activa. Las sesiones nuevas ya se registran y su borrado final o con la baja tiene reintentos durables; falta reconciliar sesiones históricas y verificar el comportamiento real del proveedor. No afirmar «no queda nada» durante una caída o sin evidencia externa.
- [ ] Confidencialidad, formación, instrucciones y acceso mínimo/revocable del personal/voluntarios. Dos personas disponibles si se promete recurso independiente; dos cuentas no acreditan independencia humana.

## 8. Edad y seguridad infantil — titular + desarrollo + asesoría

- [ ] Validar la solución proporcional al alcance/riesgos y sus afirmaciones. NFC/autenticación pasiva acredita datos firmados, **no que quien usa el móvil sea su titular**. Resolver documentos prestados/suplantación, reclamación de huellas duplicadas y alternativa accesible cuando corresponda.
- [ ] Pruebas reales Android/iPhone y activación controlada de obligatoriedad/visibilidad de perfiles existentes; no anunciar «todos verificados» sin ser cierto. No se compilan móviles en este encargo.
- [ ] Normas públicas contra explotación/abuso sexual infantil, persona de contacto y procedimiento de recepción, restricción de acceso, retirada y comunicación a autoridades competentes cuando corresponda.
- [ ] Acordar quién puede acceder, qué preservar legalmente, cuánto y cómo evitar distribución/copias innecesarias. No inventar reglas universales de conservación/denuncia ni usar material real en tests. Una etiqueta 18+ no sustituye este circuito.

## 9. Moderación operativa y DSA — operación + desarrollo + asesoría

- [ ] Activación deliberada del panel: migración, cuentas nominativas, TLS/proxy, permisos, revocación, escalado y recuperación. Cobertura humana, prioridades, alertas/vencimientos y seguimiento de plazos por caso.
- [ ] **24 h es un objetivo interno si se adopta**, no un plazo universal de Apple 1.2. Configurar los plazos a partir de requisitos realmente aplicables.
- [ ] Canales públicos para usuarios/autoridades y avisos de contenido ilegal suficientemente identificables cuando correspondan. Un reporte de perfil con texto libre no acredita todo el mecanismo DSA.
- [ ] Evidencias acotadas/fiables (hoy solo relato y texto actual del perfil), retirada, motivos exigibles y comunicación efectiva; recursos con independencia real. Procedimiento propio para reclamaciones de privacidad, aunque no use el mismo botón de recurso.
- [ ] Evaluar transparencia, reclamación y resolución extrajudicial DSA con sus exenciones; no publicar plazos de recurso inferiores a los aplicables. Si se automatiza en el futuro, evaluar art. 22 RGPD: ofrecer revisión humana no legitima por sí solo cualquier automatización.
- [ ] Cierre mediante simulacro con personal disponible. IA no es un requisito general para cumplir ni sustituye la responsabilidad del operador.

## 10. Fotos — aplazadas, siguen siendo un bloqueo de lanzamiento

- [ ] Fotos pendientes/no públicas, análisis/revisión, retirada/cachés, cuotas/fallos sin aprobar por defecto, conservación y recurso, con compatibilidad API/móvil.
- [ ] Elegir solución/proveedor, condiciones y acceso requerido. Content Safety y PhotoDNA no son equivalentes ni acreditan detectar todo abuso o comprobar identidad/edad/autenticidad.
- [ ] Cerrar el procedimiento de seguridad infantil. Google no prescribe un proveedor o metodología concretos. Cierre: pendientes no expuestos y retirada/recursos probados; sin tocar este frente ahora.

## 11. Seguridad e incidentes — desarrollo + operación

- [ ] Verificar en el entorno desplegado TLS/proxy, accesos, secretos/rotación, exposición, actualizaciones y minimización de logs/telemetría. Filtrar Phoenix y logs SQL sensibles no cubre automáticamente proxy, BD o recolectores externos.
- [ ] Backups de BD/claves y restauración probada: cerrar evidencia del runbook;
  **fotos excluidas por decisión expresa**. Límites antiabuso/DoS y capacidad
  razonable, sin vender microbenchmarks como concurrencia real.
- [ ] Brechas: detección, registro, valoración, responsables y comunicación a autoridad en **72 h desde que se tiene constancia cuando corresponda**, y a afectados cuando proceda. No toda incidencia se notifica indistintamente. Cierre: restauración e incidente simulados.

## 12. Tiendas y distribución — distinto de cumplir la ley

- [ ] App Store: UGC/contacto, privacidad, eliminación real de cuenta/datos con excepciones justificadas, autenticación y cuestionarios/clasificación vigentes. OAuth iOS pendientes antes de construir/enviar.
- [ ] Google Play: categoría, restricciones de menores aplicables, normas/contacto/declaración de seguridad infantil, Data safety y **URL web para solicitar eliminación sin reinstalar la app**.
- [ ] Etiquetas/formularios coincidentes con todos los SDK, conservación y proveedores activos. No marcar eliminación satisfecha solo por existir un botón de baja.
- [ ] Licencias/atribuciones y oferta del código correspondiente cuando lo exijan AGPL y dependencias distribuidas; comprobar el enlace de código y condiciones de distribución.
- [ ] Validación jurídica final y evidencias para tiendas. Pasar App Review no certifica legalidad y cumplir la ley no garantiza admisión.

## Orden recomendado

1. Titular/matriz → inventario/bases/riesgo → conservación.
2. Textos/consentimientos + derechos efectivos/canal público.
3. Contratos, seguridad, operación de moderación e incidentes.
4. Edad y **fotos al final**, según lo acordado; ambos deben quedar cerrados antes de abrir.
5. Validación jurídica, simulacro operativo y cuestionarios con evidencia real.

## Fuentes oficiales

Revisadas el 2026-10-16; confirmar versiones y alcance al lanzamiento:

- [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj): arts. 5–9, 12–22, 28, 30, 32–37 y capítulo V.
- [AEPD: ejercicio de derechos](https://www.aepd.es/derechos-y-deberes/ejerce-tus-derechos): canales accesibles, un mes y condiciones de prórroga/denegación.
- [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj) y [Comisión: preguntas y respuestas](https://digital-strategy.ec.europa.eu/en/faqs/digital-services-act-questions-and-answers): obligaciones según servicio/exenciones, no lista universal.
- [Apple: Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 1.2 y 5.1, entre otros; la regla general de 1.2 es respuesta oportuna, no 24 h universales.
- [Google: eliminación de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es): ruta interna, recurso web, datos asociados y excepciones legítimas.
- [Google: seguridad infantil](https://support.google.com/googleplay/android-developer/answer/14747720?hl=es): estándares públicos, mecanismo interno, actuación, leyes aplicables y persona de contacto; no impone proveedor.
