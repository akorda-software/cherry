# Privacidad y RGPD

**Estado:** pendiente. A favor ya hoy: ubicación en rejilla de 500 m (nunca coordenadas exactas), sin anuncios ni venta de datos, borrado de cuenta desde la app.

## Datos sensibles

- **Orientación sexual:** el género junto con a quién quieres conocer la revela. Es categoría especial (art. 9 del RGPD) → **consentimiento explícito**. Grindr recibió una multa millonaria en Noruega por tratar estos datos sin base válida.
- **Biometría:** el selfie y su comparación con la foto del documento (`02`) son datos biométricos de categoría especial → consentimiento explícito, borrado inmediato.
- **Documento de identidad:** solo se guarda una huella con clave secreta del número; el resto se borra al momento (`02`).

## Obligaciones

- [ ] **Evaluación de impacto (EIPD):** obligatoria por datos sensibles a gran escala, biometría y geolocalización.
- [ ] **Delegado de protección de datos (DPD):** el art. 37.1.c) lo exige cuando el tratamiento a gran escala de categorías especiales es la actividad principal. Una app de citas grande seguramente entra; se puede contratar como servicio externo.
- [ ] **Registro de actividades de tratamiento.**
- [ ] **Contratos de encargado del tratamiento** con R2/almacenamiento, el proveedor de verificación de respaldo, el servicio de moderación de fotos y el proveedor de IA de moderación.
- [ ] **Plazos de conservación** de cada dato (reportes, mensajes, cuentas borradas, evidencias de abuso infantil).
- [ ] **Decisiones automatizadas** (moderación con IA): explicarlo y garantizar revisión humana (`05`).
- [ ] Formulario de seguridad de los datos de Google Play y etiquetas de privacidad de Apple, coherentes con todo lo anterior.

## Fuentes

- [RGPD (Reglamento (UE) 2016/679)](https://eur-lex.europa.eu/eli/reg/2016/679/oj) · [AEPD – Gestión del riesgo y evaluación de impacto](https://www.aepd.es/guias/gestion-riesgo-y-evaluacion-impacto-en-tratamientos-datos-personales.pdf)
