# Cumplimiento legal y de tiendas

Dossier de trabajo para poder publicar Snack en App Store y Google Play cumpliendo la ley. Un archivo por frente; en cada uno, **por qué hay que hacerlo, qué hemos decidido, cómo lo construimos y en qué punto está**.

> **Excepción a la regla canónica de `docs/`:** el resto de documentos describen solo lo implementado. Esta carpeta mezcla a propósito investigación, plan y estado, porque es donde se va avanzando poco a poco. Cuando algo se construya, se documenta también en el documento canónico que toque (`01`, `05`, `07`…) y aquí se marca como hecho.

> **No es asesoramiento legal.** Recoge lo investigado (octubre de 2026) para decidir y construir; los textos legales finales y la evaluación de impacto deben pasar por un abogado.

## Contexto que lo condiciona todo

- **Solo España.** La instancia oficial se publica únicamente en el storefront español de ambas tiendas (`PRODUCT.md`, `decisions.md` D-2026-10-09). Quien monte su propia instancia en otro país la adapta a su ley. Esto deja fuera Ofcom (Reino Unido), las leyes de app stores de EE. UU. y los bloqueos 18+ de Apple en Australia, Brasil y Singapur.
- **Sin monetización.** Cualquier coste por usuario pesa mucho; por eso se priorizan las vías gratuitas y se buscan créditos o patrocinio (ver `08`).
- **Hay chat** (texto, tras match), además de fotos y bios: para las tiendas es contenido generado por usuarios (guideline 1.2 de Apple).

## Frentes

| # | Archivo | Qué cubre | Estado |
|---|---------|-----------|--------|
| 01 | [Requisitos de las tiendas](./01-tiendas.md) | Checklist de Apple y Google para una app de citas | Pendiente |
| 02 | [Mayoría de edad](./02-mayoria-de-edad.md) | Verificación 18+: DNI por NFC, proveedor de respaldo, app europea | Prototipo en `feat/dni-nfc` (servidor probado; NFC sin probar con DNI real) |
| 03 | [Fotos](./03-fotos.md) | Moderación automática, abuso infantil por huella, duplicados | Pendiente (hay zona de espera) |
| 04 | [Bots y cuentas falsas](./04-bots-y-cuentas-falsas.md) | Atestación del dispositivo, una persona = una cuenta, señales | Pendiente |
| 05 | [Reportes y moderación](./05-reportes-y-moderacion.md) | Panel, agentes de IA, plazos, avisos, recursos | Parcial (reportar y bloquear sí; panel no) |
| 06 | [Privacidad y RGPD](./06-privacidad-rgpd.md) | Datos sensibles, EIPD, DPD, encargados, conservación | Pendiente |
| 07 | [Textos legales](./07-textos-legales.md) | Términos, normas de la comunidad, privacidad, aviso legal | Pendiente |
| 08 | [Costes, proveedores y financiación](./08-financiacion-y-proveedores.md) | Qué es de pago, a quién pedir créditos, forma legal, donaciones | Lista hecha; sin contactar |

## Orden de trabajo propuesto

1. **Prototipo de lectura NFC del DNI** (`02`): es la pieza con más riesgo técnico; hay que confirmar pronto que funciona en Android y iPhone.
2. **Forma legal y contactos con proveedores** (`08`): en paralelo, porque las respuestas tardan.
3. **Fotos: escaneo en la zona de espera** (`03`) y **panel de moderación** (`05`).
4. **Atestación del dispositivo y señales anti-bot** (`04`).
5. **Textos legales, EIPD y cuestionarios de las tiendas** (`06`, `07`, `01`), con revisión de abogado antes de publicar.
