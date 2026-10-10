# Reportes y moderación

**Estado:** parcial. Existe: bloquear (oculta en ambas direcciones y cierra el chat), reportar con motivos (`fake_profile`, `inappropriate_photos`, `harassment`, `spam`, `underage`, `offensive_bio`, `other`; `Cherry.Dating.Safety`), deshacer match, pausar y borrar cuenta. Existen `list_reports/2`, `update_report/2` y `disable_profile`, **pero no hay panel, rutas ni vistas** de moderación.

## Por qué

- **Apple:** actuar sobre los reportes en **24 h** y términos con tolerancia cero (`01`).
- **Google Play:** reporte dentro de la app, procedimiento ante material de abuso infantil y contacto de seguridad infantil (`01`).
- **DSA** (aplica también a servicios pequeños):
  - art. 16: mecanismo de aviso y **comunicar la decisión a quien reportó**;
  - art. 17: **explicar el motivo** al afectado por cualquier restricción, indicando si se decidió con medios automáticos;
  - arts. 11–12: punto de contacto publicado para autoridades y usuarios.
- **RGPD art. 22:** una decisión solo automática con efectos importantes (banear) exige que el usuario pueda pedir **revisión humana**.

## Decisión: agentes de IA + humanos para lo dudoso

La mayoría de los casos los resuelve un agente de IA; lo dudoso pasa a una persona (el propietario o voluntarios de confianza). Condiciones:

1. **Siempre cabe recurso a un humano.** La política de privacidad explica que se usa IA.
2. **Cada decisión deja motivo** y se comunica al afectado (y el resultado a quien reportó).
3. **Material de abuso infantil:** detección por huella (`03`), retirada automática, conservación de la evidencia y denuncia a las autoridades. **Ninguna persona lo revisa** y no se envía a modelos de IA externos.
4. **Voluntarios:** acuerdo de confidencialidad firmado, acceso solo a lo necesario para su caso y registro de quién ha visto qué. Tratan datos bajo nuestra responsabilidad (art. 29 del RGPD).
5. **Prioridad:** `underage` y abuso infantil antes que todo lo demás.

## Filtro del chat

Apple pide filtrar contenido inaceptable también en mensajes. Mínimo: enlaces, teléfonos y usuarios de otras redes en los primeros mensajes, e insultos; aviso tipo «¿Te molesta este mensaje?». Gratis (reglas propias en el servidor).

## Plan

1. [ ] Panel de moderación (privado, fuera del contrato móvil): cola de reportes por prioridad, ficha del perfil, fotos y mensajes reportados, acciones.
2. [ ] Agente de IA que clasifica los reportes y propone acción; umbral para pasar a humano.
3. [ ] Registro de decisiones con motivo; aviso al afectado y a quien reportó.
4. [ ] Vía de recurso dentro de la app.
5. [ ] Procedimiento de denuncia de material de abuso infantil y contacto de seguridad infantil.
6. [ ] Filtro del chat.
7. [ ] Medir el plazo de respuesta (objetivo: < 24 h).

## Fuentes

- [Google Play – Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720)
- [DSA – texto (Reglamento (UE) 2022/2065)](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
