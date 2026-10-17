# Reportes y moderación

**Estado:** parcial, con backoffice local implementado el 2026-10-16. Existe bloquear/reportar, panel privado, permisos, cola, decisiones motivadas, advertencias/suspensiones, auditoría, buzón y recursos revisados por otra cuenta de equipo. No está desplegado/activado ni incluye fotos, agentes de IA, evidencia de chat, plazos o escalado operativo. [Detalle y límites](../14-backoffice.md).

## Por qué

- **Apple:** respuesta oportuna a reportes y moderación UGC (`01`). 24 h es un objetivo interno, no un plazo general demostrado por 1.2.
- **Google Play:** reporte dentro de la app, procedimiento ante material de abuso infantil y contacto de seguridad infantil (`01`).
- **DSA**, pendiente de matriz de aplicabilidad por tipo de servicio y exenciones (`10`); ser pequeño no excluye automáticamente toda obligación de alojamiento:
  - art. 16: mecanismo de aviso y **comunicar la decisión a quien reportó**;
  - art. 17: **explicar el motivo** al afectado por cualquier restricción, indicando si se decidió con medios automáticos;
  - arts. 11–12: punto de contacto publicado para autoridades y usuarios.
- **RGPD art. 22:** evaluar decisiones exclusivamente automatizadas según sus efectos y excepciones/garantías aplicables; ofrecer revisión humana no legitima por sí solo cualquier automatización. Las decisiones actuales de este panel son humanas.

## Decisión: agentes de IA + humanos para lo dudoso

> Propuesta histórica, **no implementada ni activada**. El primer lote actual es exclusivamente humano y no envía datos a IA. Las afirmaciones jurídicas/procedimientos de esta sección siguen pendientes de validación; no convierten una propuesta en una obligación universal ni en un procedimiento de seguridad infantil aprobado.

La mayoría de los casos los resuelve un agente de IA; lo dudoso pasa a una persona (el propietario o voluntarios de confianza). Condiciones:

1. **Siempre cabe recurso a un humano.** La política de privacidad explica que se usa IA.
2. **Cada decisión deja motivo** y se comunica al afectado (y el resultado a quien reportó).
3. **Material de abuso infantil:** cualquier futura detección/retirada requiere un protocolo aprobado de acceso restringido, preservación solo cuando corresponda y comunicación a la autoridad competente. No hay una regla universal de «conservarlo todo» ni de revisión humana indiscriminada; nunca usar material real en tests ni enviarlo a modelos externos incidentalmente.
4. **Voluntarios:** acuerdo de confidencialidad firmado, acceso solo a lo necesario para su caso y registro de quién ha visto qué. Tratan datos bajo nuestra responsabilidad (art. 29 del RGPD).
5. **Prioridad:** `underage` y abuso infantil antes que todo lo demás.

## Filtro del chat

Pendiente diseñar medidas proporcionadas de moderación/seguridad en mensajes, con privacidad y evidencias acotadas. Filtrar enlaces, teléfonos o insultos puede ser una propuesta técnica, **no un mínimo literal impuesto por Apple** ni garantía de cumplimiento; no activar inspección indiscriminada del chat.

## Plan

1. [x] Panel privado con cola/prioridad, asignación, texto actual del perfil y decisiones; fotos y mensajes reportados todavía no se muestran.
2. [ ] Agente de IA que clasifica los reportes y propone acción; umbral para pasar a humano.
3. [x] Registro de decisiones con motivo y respuestas privadas por destinatario en el buzón (sin envío externo).
4. [x] Vía de recurso en la app y revisión por una cuenta distinta de quien decidió originalmente.
5. [ ] Procedimiento de denuncia de material de abuso infantil y contacto de seguridad infantil.
6. [ ] Filtro del chat.
7. [ ] Medir el plazo de respuesta (objetivo: < 24 h).

## Fuentes

- [Google Play – Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720)
- [DSA – texto (Reglamento (UE) 2022/2065)](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
