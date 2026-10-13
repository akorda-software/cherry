# Certificados CSCA de confianza

Raíces de confianza de la autenticación pasiva de documentos (`Cherry.Identity.Document.TrustStore`).
Se leen todos los `.pem`, `.crt`, `.cer` y `.der` de esta carpeta y sus subcarpetas.
`CSCA_PATHS` sustituye esta carpeta por otras rutas y `CSCA_COUNTRIES` (p. ej. `es,fr`) confía solo en
esas subcarpetas de país (una por país, con su código ISO alfa-2 en minúsculas); ver
`docs/12-self-hosting.md` §4 y §10.

Un CSCA (Country Signing CA) es la raíz con la que un Estado firma los certificados de los
firmantes de documentos, que a su vez firman el SOD de cada DNI o pasaporte. Son certificados
**públicos**: no son secretos ni datos personales.

## Contenido (revisado el 2026-10-09)

Solo España (la instancia oficial es solo para España). Todos son RSA-4096 con
sha256WithRSAEncryption, autofirmados, con `C=ES, O=DIRECCION GENERAL DE LA POLICIA,
serialNumber=N, CN=CSCA SPAIN`.

| Fichero | Validez | SHA-1 (la que publica la Policía) | SHA-256 | Origen |
|---|---|---|---|---|
| `es/csca-spain-2.pem` | 2012-07-11 → 2027-10-11 | `271BB2A6010320C6B90BB56F9F97F624B4F21899` | `90EB8108CAE5806DEC6A11A9D3D515D5032E869310FE6A4D097488064D1D9BC1` | Master list del BSI (la descarga de la Policía para CSCA 2 da 404); huella comprobada con la web de la Policía |
| `es/csca-spain-3.pem` | 2017-06-07 → 2032-09-07 | `6AEB147EA371476D9AAAA392F257C0CF3C3EF6C7` | `BF105C1496821A978447078E2D5007B6C177D31F90AC90D4B12F62A2FA333D5B` | `dnielectronico.es/descargas/mrtd/CSCA_3_RAIZ.zip` |
| `es/csca-spain-4.pem` | 2022-05-18 → 2037-08-18 | `8031D7733A8779526D9246CED83DCF6D6A52058B` | `1C2C6FF09F78A3BCB2C65B531169CEC2EB3200397AA72BF5B2210BC6E0F17209` | `dnielectronico.es/descargas/mrtd/CSCA_4_RAIZ.zip` |

Las tres huellas SHA-1 coinciden con las publicadas en la página oficial de la Policía:
<https://www.dnielectronico.es/PortalDNIe/PRF1_Cons02.action?pag=REF_1093&id_menu=52>.

No se incluyen los certificados de enlace (3→4, 2→3): tienen la misma clave que las raíces y la
autenticación pasiva usa cada CSCA directamente como ancla, sin construir cadenas entre CSCA.

## Fuentes

- **Policía Nacional (fuente primaria):** página de certificados MRTD de dnielectronico.es (enlace
  arriba), con descargas en `https://www.dnielectronico.es/descargas/mrtd/` y las huellas SHA-1.
  CRL: `http://pki.policia.es/csca/crls/ESP.crl` (firmada por CSCA 4; aún no se consulta).
  La master list española (`http://pki.policia.es/csca/MasterList/SpanishMasterList.ml`) está
  parada desde 2022 y no incluye CSCA 4: **no usarla para actualizar**.
- **BSI (Alemania), segunda fuente:** «German Master List» en
  <https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/ElekAusweise/CSCA/GermanMasterList.html>.
  Pública, se actualiza cada 1–3 meses e incluye España (CSCA 2, 3 y 4). Permite uso comercial
  sin publicidad ni apariencia de cooperación con el BSI. Firmada por el BSI con ECDSA y
  parámetros explícitos (OpenSSL 3 no la verifica con las opciones por defecto).
- **ICAO PKD:** descarga gratuita pero con términos de uso no comercial y sin redistribución;
  no se usa.

## Actualizar

España publicará previsiblemente un CSCA 5 hacia 2027 (el periodo de uso de la clave de CSCA 4
acaba el 2027-05-18). Revisar cada pocos meses:

1. Descargar el certificado nuevo de la página de la Policía (o extraerlo de la master list del
   BSI: `mix cherry.csca GermanMasterList.ml --country ES --export /tmp/es`).
2. Comprobar sus huellas: `mix cherry.csca /ruta/al/certificado.pem` y comparar la SHA-1 con la
   publicada por la Policía. Si viene de la master list del BSI, la tarea **no** verifica la firma
   de la lista: la huella publicada por la Policía es la comprobación.
3. Copiarlo a `es/csca-spain-N.pem`, añadir la fila a la tabla de arriba y desplegar. Los
   certificados se cargan al primer uso; tras cambiar ficheros en caliente, reiniciar el backend.
4. No borrar CSCA antiguos mientras haya documentos en vigor firmados bajo ellos (un DNI dura
   hasta 10 años; la validez de cada CSCA ya lo cubre).
