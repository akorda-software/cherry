# Costes, proveedores y financiación

**Estado:** lista hecha; nadie contactado todavía. Precios consultados en octubre de 2026; varios salen de comparativas escritas por los propios proveedores, así que hay que confirmarlos.

## Qué es gratis

- App Attest (iOS) y Play Integrity (Android).
- «Restrict Declared Minors» de Google Play y Declared Age Range de Apple.
- Microsoft PhotoDNA y Cloudflare CSAM Scanning Tool (hay que solicitarlos).
- Lectura NFC del DNI y comparación de caras con modelos de código abierto (solo coste de servidor).
- Panel de moderación, filtro del chat, límites de uso y duplicados (desarrollo propio).

## Qué es de pago

| Herramienta | Precio público aproximado |
|---|---|
| Didit (prueba de vida + estimación de edad) | ~0,20 $ por usuario; 500 gratis al mes permanentes; documento +0,15 $ |
| Veriff | 0,80–1,89 $ por verificación, con mínimo mensual |
| Persona | Programa para startups: 12 meses con 500 al mes gratis; después 1 $ |
| Yoti, FaceTec, Veridas, Facephi | Solo por presupuesto |
| AWS Rekognition (fotos) | ~0,001 $ por imagen el primer millón al mes |
| Sightengine (fotos) | 2.000 gratis al mes; 29–99 $/mes |
| Apple Developer | 99 €/año (posible exención para asociaciones) |
| Google Play | 25 $ una vez |
| Abogado (textos, EIPD) | Pago único; pedir 2–3 presupuestos |
| DPD externo | Cuota mensual, probablemente necesario al crecer (`06`) |

**Por qué el NFC cambia las cuentas:** verificar a todo el mundo con un proveedor costaría ~20.000–25.000 $ por cada 100.000 usuarios. Con el NFC como vía principal, el proveedor solo lo usa quien no puede leer el chip. Ejemplo hipotético: si es el 10 % de 100.000 usuarios, ~10.000 verificaciones; las ~6.000 gratis al año de Didit cubren la mayoría y el resto sale por ~1.000–2.000 $. Casi todo el coste se paga una vez por usuario nuevo, no por uso.

## Forma legal (decisión pendiente)

| Forma | Da acceso a |
|---|---|
| **Asociación sin ánimo de lucro** (recomendada) | Créditos de AWS vía TechSoup España (1.000–5.000 $/año), Google for Nonprofits, quizá la exención de Apple, Cloudflare Project Galileo (encaje dudoso). El aviso legal publica los datos de la asociación, no los tuyos |
| **Empresa (SL)** | Cloudflare for Startups (10.000 $ sin financiación), programa de Persona (pide empresa constituida), AWS Activate, Google for Startups |

## A quién contactar

### Verificación (respaldo del NFC)

| Empresa | Qué pedir | Contactado |
|---|---|---|
| **Didit** (nació en Barcelona) | Más cupo gratis o precio especial. Primera a contactar | [ ] |
| **Persona** | Entrar en el programa para startups y ampliar el plazo | [ ] |
| **Veridas** (Navarra; pone las citas como caso de uso; lee el DNI 4.0) | Precio para proyecto social o patrocinio | [ ] |
| **Facephi** (Alicante) | Precio para proyecto social o patrocinio | [ ] |
| **FaceTec** | Que nos pasen a un distribuidor sin mínimo mensual | [ ] |
| **Yoti** | Precio para proyecto social | [ ] |
| **Veriff** | Solo presupuesto, como referencia para negociar | [ ] |

### Fotos e IA

| Empresa | Qué pedir | Contactado |
|---|---|---|
| **AWS** (Rekognition, Bedrock) | TechSoup España (asociación) o AWS Activate (empresa) | [ ] |
| **Google Cloud** (Vision SafeSearch, Gemini) | Google for Nonprofits o Google for Startups | [ ] |
| **Sightengine** | Plan para proyecto de código abierto | [ ] |
| **Proveedores de IA** (Anthropic, OpenAI…) | Créditos para los agentes moderadores (programas sin comprobar) | [ ] |

### Gratis, solo solicitar

| Servicio | Contactado |
|---|---|
| Microsoft PhotoDNA | [ ] |
| Cloudflare CSAM Scanning Tool | [ ] |
| Exención de la cuota de Apple (si asociación) | [ ] |

### Qué contar en el correo

- Código abierto (AGPL), gratis, sin anuncios ni venta de datos.
- Solo España, con un volumen previsto realista.
- A cambio: mención en la web y el repositorio («verificación con X»), caso de uso público y feedback técnico.
- Una app de citas que verifica a todos sus usuarios es un buen escaparate para un proveedor de identidad.
- Pedir cifras concretas («X verificaciones gratis al mes durante 2 años»), no un «ayúdanos» genérico.
- No depender de un patrocinio: el proveedor tiene que poder cambiarse sin rehacer la app.

## Donaciones

- **Fuera de la app:** Open Collective (gastos públicos, encaja con la transparencia), GitHub Sponsors o Liberapay, en la web y el repositorio.
- **No dentro de la app:** Apple exige compra integrada para las donaciones al desarrollador, y en la UE un enlace externo requiere su permiso y lleva comisión.
- Lo que más convence: «verificar a cada usuario cuesta X €; este mes hemos cubierto Y».

## Fuentes

- [Didit – reseña y precios](https://makerstack.co/reviews/didit-review/) · [Didit – Quiénes somos](https://didit.me/about-us/) · [Didit vs Veriff](https://didit.me/blog/comparison-didit-vs-veriff-the-best-kyc-alternatives/)
- [Persona – Startup Program](https://withpersona.com/startups/) · [Detalles del programa](https://sourcey.com/c/persona/offers/persona-startup-program-general-cohort)
- [Veridas – verificación de edad](https://veridas.com/en/age-verification/) · [Veridas y el nuevo DNI](https://veridas.com/en/the-new-spanish-id-card/) · [Facephi – verificación de edad en España](https://facephi.com/en/age-verification-spain/) · [Precios de FaceTec](https://www.facetec.com/pricing)
- [Precios de AWS Rekognition](https://aws.amazon.com/rekognition/pricing/) · [Precios de Sightengine](https://sightengine.com/pricing)
- [Apple – exención de la cuota](https://developer.apple.com/support/fee-waiver) · [Apple – cambios para apps en la UE](https://developer.apple.com/support/apps-in-the-eu/) · [Caso «Buy Me a Coffee» con Apple](https://medium.com/@robert-baer/my-ongoing-battle-with-apple-over-a-buy-me-a-coffee-link-is-over-9c158df81c05)
- [AWS – créditos para ONG](https://aws.amazon.com/government-education/nonprofits/nonprofit-credit-program/) · [Google for Nonprofits – requisitos en España](https://www.google.com/intl/es/nonprofits/eligibility/) · [Cloudflare for Startups](https://creditforstartups.com/companies/cloudflare) · [Cloudflare Project Galileo](https://www.cloudflare.com/th-th/galileo)
