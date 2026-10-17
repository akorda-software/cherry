# Requisitos de las tiendas

**Estado:** pendiente. Es el checklist final antes de enviar a revisión; la mayoría de puntos se resuelven en otros archivos.

## Apple (App Store)

**Guideline 1.2 — contenido generado por usuarios.** Perfiles, fotos y chat la activan. Exige:

- [ ] Filtrar contenido inaceptable (fotos: `03`; chat: filtro de enlaces, teléfonos e insultos en `05`).
- [ ] Reportar contenido con respuesta oportuna. **24 h es un objetivo operativo si se adopta, no un plazo universal establecido en Apple 1.2** (`05`, checklist `10`).
- [x] Bloquear a usuarios abusivos (existe: `Cherry.Dating.Safety.block/2`).
- [ ] Contacto publicado (web y ficha de la tienda).
- [ ] **EULA/términos aceptados por el usuario con tolerancia cero** hacia contenido inaceptable y usuarios abusivos (`07`).
- El incumplimiento de las políticas puede provocar retirada/rechazo; comprobar siempre la versión oficial vigente, sin basar una obligación en fechas o interpretaciones de blogs.

**Guideline 1.1.4.** Rechaza apps de «hookup» con pornografía o que faciliten la prostitución. La intención «casual» no es problema (Tinder y Feeld están publicadas), pero las normas de la comunidad deben prohibir ambas cosas (`07`).

**Clasificación por edad.** Desde 2025 hay 4+, 9+, 13+, 16+ y 18+. Las apps de citas grandes van como **18+** (solo se puede forzar hacia arriba).

- [ ] Cuestionario de edad en App Store Connect con 18+.
- [ ] Preguntas sobre redes sociales del cuestionario (obligatorias desde septiembre de 2026 en cada envío).

**Declared Age Range API.** Obligatoria solo donde la ley lo exige (Texas, Utah, Luisiana, Australia, Brasil, Singapur…). **En España no es obligatoria**; es una señal opcional que se puede leer (ver `02`).

**Implementación parcial:** existe soporte de Sign in with Apple, pendiente de configuración/prueba iOS. Existe baja desde la app, pero **no acredita supresión completa de datos asociados**; cerrar retención/excepciones y el procedimiento real (`10`).

## Google Play

- [ ] Declarar la categoría **Citas** en Play Console.
- [ ] **Activar «Restrict Declared Minors»** (obligatorio para apps de citas desde el 28 de enero de 2026). Bloquea a los usuarios que Google tiene como menores; nuestro registro no debe saltárselo.
- [ ] **Política de estándares de seguridad infantil** (aplica aunque la app sea solo para adultos):
  - [ ] Normas públicas que prohíban expresamente la explotación y el abuso sexual infantil (`07`).
  - [x] Forma de reportar dentro de la app (existe).
  - [ ] Procedimiento ante material de abuso infantil (`03`, `05`).
  - [ ] Cumplir las leyes de protección infantil y denunciar a las autoridades.
  - [ ] Designar un **contacto de seguridad infantil** en Play Console.
- [ ] Formulario de seguridad de los datos (Data safety) coherente con la política de privacidad (`06`).
- [ ] URL web funcional para pedir eliminación de cuenta/datos sin reinstalar la app, además del flujo interno; no basta el buzón con sesión ni la baja lógica ([política oficial](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es)).

## Fuentes

- [Apple – App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Apple – Age ratings](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions) · [Apple – Age assurance Q&A](https://developer.apple.com/support/age-assurance)
- [Lo que mira App Review (octubre de 2026)](https://blakecrosley.com/blog/app-review-what-reviewers-look-for-2026)
- [Google Play – Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720) · [Google Play – Anuncios de políticas](https://support.google.com/googleplay/android-developer/announcements/13412212?hl=en)
