# Certificados CSCA de confianza

Raíces de confianza de la autenticación pasiva de documentos (`Cherry.Identity.Document.TrustStore`).
Se leen todos los `.pem`, `.crt`, `.cer` y `.der` de esta carpeta y sus subcarpetas.
`CSCA_PATHS` sustituye esta carpeta por otras rutas y `CSCA_COUNTRIES` (p. ej. `es,fr`) confía solo en
esas subcarpetas de país (una por país, con su código ISO alfa-2 en minúsculas); ver
`docs/12-self-hosting.md` §4 y §10.

Un CSCA (Country Signing CA) es la raíz con la que un Estado firma los certificados de los
firmantes de documentos, que a su vez firman el SOD de cada DNI o pasaporte. Son certificados
**públicos**: no son secretos ni datos personales.

## Contenido (revisado el 2026-10-14)

Una carpeta por país (código ISO alfa-2 del `C` del certificado, en minúsculas): 638 certificados
de 130 emisores, incluidos los salvoconductos de la UE (`eu`) y la ONU (`un`) y Kosovo (`ks`).
Vienen de dos listas maestras públicas, importadas solo después de comprobar su firma
(ver [Actualizar](#actualizar)):

| Lista | Fecha | Certificados | CSCA que la firma (SHA-256, comprobada con su web oficial) |
|---|---|---|---|
| BSI (Alemania), `DE_ML_2026-10-01-11-50-52.ml` | 2026-10-01 | 609 (600 nuevos, 6 descartados) | `csca-germany` 10/2024: `2084AED7A991B3158E63AD750D3DC38BC6C9DCF5958F28D1162F49884E91ADA8` |
| NPKD (Países Bajos), `NL_MASTERLIST.mls` | 2026-07-22 | 411 (35 nuevos) | `CSCA NL` serialNumber=7: `411356D206B99DA15EFADF4B84149F8600EE6260C6727CD6BC230D6B6E151A24` |

Las dos listas se avalan entre sí: el CSCA neerlandés está en la lista alemana y el alemán en la
neerlandesa. Los 6 descartados de la lista alemana son certificados de enlace de Camerún,
Portugal, Turquía y Luxemburgo marcados como «no CA» (no pueden anclar una cadena; esos países
tienen sus CSCA en otros ficheros). Los ficheros importados se llaman
`csca-<país>-<16 primeros caracteres del SHA-256>.pem`.

### España

Los tres CSCA españoles se añadieron a mano antes que las listas, con su huella comprobada contra
la web de la Policía. Todos son RSA-4096 con sha256WithRSAEncryption, autofirmados, con
`C=ES, O=DIRECCION GENERAL DE LA POLICIA, serialNumber=N, CN=CSCA SPAIN`. La lista del BSI añadió
dos más en `es/`: `csca-es-1A4225B479AA74E5.pem`, el certificado de enlace de la clave de CSCA 4
firmado por CSCA 3, y `csca-es-43BD93B894A9C33B.pem`, otro autofirmado con la clave de CSCA 3
(con otro número de serie).

| Fichero | Validez | SHA-1 (la que publica la Policía) | SHA-256 | Origen |
|---|---|---|---|---|
| `es/csca-spain-2.pem` | 2012-07-11 → 2027-10-11 | `271BB2A6010320C6B90BB56F9F97F624B4F21899` | `90EB8108CAE5806DEC6A11A9D3D515D5032E869310FE6A4D097488064D1D9BC1` | Master list del BSI (la descarga de la Policía para CSCA 2 da 404); huella comprobada con la web de la Policía |
| `es/csca-spain-3.pem` | 2017-06-07 → 2032-09-07 | `6AEB147EA371476D9AAAA392F257C0CF3C3EF6C7` | `BF105C1496821A978447078E2D5007B6C177D31F90AC90D4B12F62A2FA333D5B` | `dnielectronico.es/descargas/mrtd/CSCA_3_RAIZ.zip` |
| `es/csca-spain-4.pem` | 2022-05-18 → 2037-08-18 | `8031D7733A8779526D9246CED83DCF6D6A52058B` | `1C2C6FF09F78A3BCB2C65B531169CEC2EB3200397AA72BF5B2210BC6E0F17209` | `dnielectronico.es/descargas/mrtd/CSCA_4_RAIZ.zip` |

Las tres huellas SHA-1 coinciden con las publicadas en la página oficial de la Policía:
<https://www.dnielectronico.es/PortalDNIe/PRF1_Cons02.action?pag=REF_1093&id_menu=52>.

La autenticación pasiva usa cada CSCA directamente como ancla, sin construir cadenas entre CSCA:
los certificados de enlace que traen las listas no estorban (tienen la misma clave que la raíz).

## Fuentes

- **Policía Nacional (fuente primaria):** página de certificados MRTD de dnielectronico.es (enlace
  arriba), con descargas en `https://www.dnielectronico.es/descargas/mrtd/` y las huellas SHA-1.
  CRL: `http://pki.policia.es/csca/crls/ESP.crl` (firmada por CSCA 4; aún no se consulta).
  La master list española (`http://pki.policia.es/csca/MasterList/SpanishMasterList.ml`) está
  parada desde 2022 y no incluye CSCA 4: **no usarla para actualizar**.
- **BSI (Alemania):** «German Master List» en
  <https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/ElekAusweise/CSCA/GermanMasterList.html>.
  Pública, se actualiza cada 1–3 meses e incluye España (CSCA 2, 3 y 4). Permite uso comercial
  sin publicidad ni apariencia de cooperación con el BSI. Firmada por el «CSCA Master List
  Signer» del BSI, que emite el CSCA alemán, con ECDSA y parámetros explícitos (OpenSSL 3 no
  valida esa cadena; `mix cherry.csca --signed-by` sí). CSCA alemán y huellas:
  <https://www.bsi.bund.de/EN/Themen/Oeffentliche-Verwaltung/Elektronische-Identitaeten/Public-Key-Infrastrukturen/CSCA/Root_Cert_Germany/Zertifikate_der_CSCA-PKI.html>.
- **NPKD (Países Bajos):** <https://www.npkd.nl/masterlist.html> (descarga
  `files/ml/NL_MASTERLIST.mls`, con su SHA-256 publicado en la página). Solo certificados
  autofirmados. Firmada por el «Masterlist Signer NL», que emite el CSCA NL; los CSCA
  neerlandeses están en `files/nl-csca-certificates.zip` de la misma web.
- **ICAO PKD:** descarga gratuita pero con términos de uso no comercial y sin redistribución;
  no se usa.

## Actualizar

Cada pocos meses (las listas se renuevan cada 1–3 meses; España publicará previsiblemente un
CSCA 5 hacia 2027, cuando acaba el periodo de uso de la clave de CSCA 4, el 2027-05-18):

1. Descarga las dos listas y el CSCA vigente de cada Estado que las firma (enlaces en
   [Fuentes](#fuentes)). Fuera del repositorio, p. ej. en `/tmp/csca`.
2. Comprueba el CSCA de cada Estado contra la huella de su web oficial:
   `openssl x509 -inform DER -in csca.cer -noout -fingerprint -sha256`. Si el Estado ha renovado
   su CSCA, usa el nuevo. Pásalo a PEM (`openssl x509 -inform DER -in csca.cer -out csca.pem`).
3. Importa cada lista. La tarea rechaza la lista si su firma no cuadra con ese CSCA y solo
   escribe los certificados que aún no están:

   ```bash
   cd apps/backend
   mix cherry.csca /tmp/csca/DE_ML_*.ml --signed-by /tmp/csca/de-csca.pem --export-countries priv/csca
   mix cherry.csca /tmp/csca/NL_MASTERLIST.mls --signed-by /tmp/csca/nl-csca.pem --export-countries priv/csca
   ```

4. Revisa los descartados que lista la tarea, actualiza la tabla de [Contenido](#contenido-revisado-el-2026-10-14)
   y pasa los tests (`mix test test/cherry/identity`). Despliega: los certificados se cargan
   al primer uso; tras cambiar ficheros en caliente, reinicia el backend.
5. No borres CSCA antiguos mientras haya documentos en vigor firmados bajo ellos (un DNI dura
   hasta 10 años; la validez de cada CSCA ya lo cubre). Los caducados tampoco estorban: con un
   documento caducado de un menor, la edad se comprueba igual.

Para un CSCA suelto (p. ej. el CSCA 5 español desde la web de la Policía):
`mix cherry.csca /ruta/al/certificado.pem` muestra sus huellas para compararlas con las oficiales;
cópialo después a su carpeta de país.
