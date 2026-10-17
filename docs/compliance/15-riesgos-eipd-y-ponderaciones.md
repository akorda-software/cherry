# Riesgos, EIPD, DPD y ponderaciones

**17-10-2026 · evaluación preliminar para completar, no EIPD aprobada.**
Responsable: Albert. Revisor especializado: `[NOMBRE / CONTACTO]`.

## Decisión de EIPD

Hay tratamiento íntimo/sensible, compatibilidad de perfiles, localización y
riesgo de outing, discriminación y violencia. La evaluación no puede reducirse
a «somos pocos» ni a pasar tests. Determinar criterios de art. 35 y listas AEPD,
escala, seguimiento, vulnerabilidad y combinación de fuentes. **No se concluye
que no haga falta EIPD.** Si el tratamiento es de alto riesgo, realizarla antes
del inicio; consulta previa art. 36 si persiste alto riesgo no mitigado.

Completar: descripción/flujos y necesidad → alternativas menos intrusivas →
riesgos para personas (no solo negocio) → salvaguardas verificadas → riesgo
residual → opinión de DPD si lo hay y participación de interesados cuando
proceda → aprobación responsable → condiciones/fecha de revisión.

## Riesgos prioritarios

| Riesgo para personas | Salvaguardas existentes | Falta / residual preliminar |
|---|---|---|
| Revelar orientación, preferencias o relaciones | Acceso autenticado, bloqueos recíprocos, R2 privado, no indexación de perfiles | Capturas, inferencias, cliente viejo y consentimientos no distribuidos: **alto hasta validación** |
| Localizar domicilio o rutinas | Rejilla ~500 m, distancias aproximadas, sin coordenadas exactas enviadas por flujo móvil | Inferencia por repetición, zonas poco pobladas y datos de bio/foto; evaluar alternativas y pruebas |
| Acceso interno abusivo | Roles, auditoría, no visor de chats/fotos, revocación | Personal/compromisos reales, revisión de TLS/exposición y credenciales de infraestructura |
| Suplantación y menores | Declaración, validación NFC y HMAC disponibles, límites, reportes | Documento prestado no resuelto, pruebas Android/iOS, obligatoriedad y seguridad infantil/fotos pendientes |
| Borrado que reaparece | Diario cifrado, registro externo previo y replay obligatorio, ensayo aislado | Host físico no ensayado, clave offline titular y disponibilidad de registro/limpieza |
| Incumplir derechos o sanción injusta | Buzón, decisiones motivadas, recursos con cuenta distinta, suspensión reversible | Dos personas reales, recepción sin sesión atendida, ejecución/entrega de derechos y bloqueos legales |
| Captación/CSAM/violencia | Normas, prioridad posible menor, suspensión | Procedimiento y moderación de fotos sin cerrar. No utilizar material ilegal en tests |
| Robo de mensajes | Cifrado en BD y sesiones revocables | No E2EE; servidor/clave puede descifrar; minimizar logs, acceso host y payloads push |
| Datos enviados a terceros fuera de garantías | Sin IA/monetización; buckets UE | Roles, DPA, transferencias y retención de servicios reales sin acreditar |

No asignar números arbitrarios para convertir riesgos abiertos en aceptables.
Cada cierre necesita responsable, evidencia reproducible y fecha.

## DPD

Documentar actividad principal, escala prevista/real, sensibilidad, observación
regular/sistemática y art. 34 LOPDGDD. `[DECISIÓN MOTIVADA PENDIENTE]`. Si resulta
obligatorio o se designa voluntariamente: independencia, recursos, conflicto de
intereses, comunicación a AEPD y contacto público. **El titular/superusuario no
se anuncia como DPD por defecto** ni se confunde correo de privacidad con DPD.

## LIA-01 — Seguridad y unicidad documental (propuesta)

- Interés concreto: limitar cuentas simultáneas, fraudes y acceso de menores,
  no identificar ideología/orientación ni imponer una lista negra perpetua.
- Necesidad: comparar verificaciones sin guardar número/copia documental. Evaluar
  alternativas: acceso sin verificación, solo declaración, proveedores de prueba
  de edad mínima, verificación manual accesible; documentar por qué cada una basta
  o no para el riesgo real.
- Balance: documento/HMAC siguen siendo personales; riesgo de exclusión,
  colisiones operativas/suplantación, tratamiento forzoso y documentos no
  compatibles. Menores no deben convertirse en usuarios por este análisis.
- Garantías propuestas: HMAC con clave protegida, no número/copia persistida,
  límite de intentos, revisión proporcionada y alternativa a definir, baja libera
  documento, sin reusar huella para otros fines; NFC no prueba identidad del portador.
- Art. 9/10: esta ponderación **no habilita** biometría de identificación unívoca
  ni categorías especiales/penales por sí sola.
- Conclusión y aprobación: `[PENDIENTE]`; revisar si se activa Didit/biometría.

## LIA-02 — Reportes y seguridad de comunidad (propuesta)

- Interés: recibir hechos de abuso y mantener servicio seguro, no leer chats de
  forma general ni perseguir a personas fuera de Cherry.
- Necesidad: relato mínimo y cuenta/contenido identificable, respuesta y auditoría
  acotada; no copiar toda conversación ni identificar al denunciante al afectado.
- Balance: denuncias falsas, intimidad, datos de terceros, represalias y
  discriminación. Resolver por hechos, motivos, revisión independiente y no conteo.
- Garantías: roles, bloqueo, suspensión reversible con derechos intactos, datos
  mínimos, borrado y conservación de medida ajena sin denunciante solo cuando
  procede. Ponderar plazos y ficha mínima; no usar interés legítimo para eludir
  categorías especiales, art. 10 o deberes legales.
- Conclusión, base por operación y aprobación: `[PENDIENTE]`.

## LIA-03 — Logs, recuperación y personal (propuesta)

Continuidad y protección frente a accesos indebidos son intereses concretos.
Usar mínimos eventos/identificadores, TTL aprobado por sistema y acceso
restringido. No conservar cuerpos, tokens, DNI o chats en logs, alertas o issues.
La auditoría de personal no permite vigilancia indiscriminada. Verificar proxy,
BD y recolectores, no solo Phoenix. Documentar alternativas, necesidad de cada
campo, impacto y garantías internacionales del canal de alertas.
Conclusión/retención/aprobación: `[PENDIENTE]`.
