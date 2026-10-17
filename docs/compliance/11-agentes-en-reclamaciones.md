# Agentes para reclamaciones — estudio, no implementación

Petición del propietario, 2026-10-16: reducir carga humana en una operación gratuita con pocas personas. **No hay bots activos, proveedor elegido, credenciales nuevas, envíos de expedientes a IA ni decisiones automáticas habilitadas.** Las fotos siguen fuera de este frente.

## Recomendación por etapas

1. **Reglas deterministas:** justificante, clasificación elegida por quien solicita, prioridad de posible menor y deduplicación exacta. Ya existen justificantes/prioridad y algunas reglas de idempotencia. No confundir agrupar duplicados con desestimar una acusación.
2. **Asistencia sin efectos:** proponer categoría, resumir sin datos innecesarios, señalar información que falta y redactar una respuesta para revisión. La persona puede ignorar la sugerencia. El estado y la medida sobre la cuenta no cambian.
3. **Automatización acotada:** estudiar solo tras validar necesidad, calidad y legalidad. Un acuse o instrucciones generales pueden ser sencillos; suspender, denegar derechos, cerrar reclamaciones sustantivas o resolver un recurso no son automáticamente inocuos por parecer fáciles al modelo. La confianza declarada por un LLM no demuestra certeza.

## Circuito técnico propuesto

`expediente → minimización → clasificación/sugerencia tipada → validación → revisión humana → resolución existente`

- Adaptador propio, reemplazable: posible modelo autoalojado o proveedor externo, todavía sin elegir. Alojamiento local también consume recursos y necesita seguridad/evaluación.
- Cuenta de servicio distinta de un humano, permisos mínimos y revocables; sin capacidad de otorgar roles, borrar cuentas, leer conversaciones completas, ejecutar herramientas/shell ni acceder a secretos.
- Relatos como **contenido no confiable**: una denuncia puede contener instrucciones maliciosas. Nunca convertir texto del expediente en instrucciones de sistema ni permitir que abra URLs o invoque herramientas.
- Salida con esquema/allowlist, motivo y referencia a evidencia disponible. No inventar hechos, identidad, pruebas históricas ni una certeza que el panel no tiene. Abstención y escalado cuando falte información, haya ambigüedad o contenido de riesgo.
- Jobs separados, idempotencia y control de versiones para evitar que una sugerencia antigua sobrescriba un expediente resuelto o borrado. El borrado debe limpiar también entradas/resultados del agente y cualquier copia externa.
- Auditoría de modelo/política/fecha y aceptación humana, evitando guardar prompts con datos personales por defecto. Sugerencia y decisión deben distinguirse en UI y trazabilidad.
- Interruptor global de desactivación; límites de concurrencia, tiempo, coste/cupo y reintentos. Caída, cuota agotada o respuesta inválida → cola humana, no aprobación ni rechazo por defecto.

## Condiciones antes de activar

- Definir qué tareas puede ejecutar y cuáles nunca: privacidad, menores, sanciones y recursos requieren especial cautela.
- Evaluar arts. 9, 22 y 35 RGPD cuando corresponda, aplicabilidad/exenciones DSA, condiciones de tiendas, información al usuario y revisión humana efectiva. Una casilla de consentimiento o un recurso posterior no legitiman por sí solos cualquier decisión automatizada.
- Si hay proveedor: contrato/roles, ubicación y transferencias, conservación, entrenamiento/no reutilización, borrado y exposición del contenido. No enviar datos reales solo para probar una demo.
- Evaluación con casos sintéticos benignos: falsos positivos/negativos, denuncias maliciosas, texto adversarial, idiomas, sesgos, reclamaciones repetidas y derivación correcta. Medir el ahorro real y la tasa de errores, no solo rapidez.
- Comenzar en modo sombra, sin actuar. Presupuesto y criterios de aceptación acordados antes de permitir efectos. La automatización no sustituye a alguien responsable de atender lo que escala.

La siguiente decisión no es contratar un servicio: es elegir si el primer piloto será **solo clasificación y borradores de respuesta**. No se toma esa decisión ni se activa un proveedor en este lote.
