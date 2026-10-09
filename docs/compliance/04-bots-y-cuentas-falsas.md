# Bots y cuentas falsas

**Estado:** pendiente. Lo que ya existe: inicio de sesión solo con Google o Apple (frena el registro masivo con correos desechables) y límites en subida de fotos y ubicación. Pendiente según `docs/01-requisitos-producto.md`: velocidad de swipe imposible, límites en login y refresh, límites a la creación de cuentas y marcas internas de usuario sospechoso.

## Por qué

No es una obligación legal concreta, pero es la promesa de marca (un sitio sin bots) y reduce la carga de moderación. Tinder dice que, donde aplica Face Check, la exposición a cuentas maliciosas bajó más de un 60 % (dato de la propia empresa).

## Capas

No hay una solución única; se apilan:

1. **Google / Apple como único inicio de sesión.** Ya existe.
2. **Atestación del dispositivo:** App Attest (iOS) y Play Integrity (Android), **verificadas en el servidor** con un nonce de un solo uso, exigidas en el registro, la verificación, la subida de fotos, los likes y el primer mensaje. Gratis (Play Integrity: 10.000 peticiones al día, ampliables gratis bajo solicitud).
   - **Va antes de cualquier paso de pago** (proveedor de respaldo de `02`), para que los bots no nos cuesten dinero.
   - Prever falsos positivos (Android con ROM personalizada): pedir otra comprobación en lugar de banear.
3. **Verificación con documento y selfie** (`02`). Ningún perfil es visible sin ella.
4. **Una persona, una cuenta:** la huella del número de documento impide crear varias cuentas y volver después de un baneo. Gratis y muy eficaz.
5. **Señales de comportamiento:** likes a velocidad imposible, mensajes copiados y pegados, enlaces o usuarios de Telegram e Instagram en los primeros mensajes, muchos reportes en una cuenta nueva. Respuesta: restringir y pedir otra comprobación, o pasar a moderación (`05`).
6. **Reportes y revisión humana:** siempre hará falta. Existen granjas de cuentas (personas reales pasan la verificación y luego entregan la cuenta a un bot).

## Plan

1. [ ] Módulo Expo de App Attest / Play Integrity y verificación en el backend.
2. [ ] Exigir la atestación en los endpoints sensibles.
3. [ ] Límites de uso pendientes (login, refresh, swipes, creación de cuentas).
4. [ ] Señales de comportamiento y marcas internas de usuario sospechoso.
5. [ ] Huella del documento (depende de `02`).

## Fuentes

- [Play Integrity – visión general](https://developer.android.com/google/play/integrity/overview) · [Play Integrity – cuota](https://developer.android.com/google/play/integrity/setup)
- [Tinder Face Check](https://www.biometricupdate.com/202510/match-group-making-face-liveness-mandatory-for-us-tinder-users) · [Bumble – seguridad](https://support.bumble.com/hc/en-us/articles/28537051467293-Our-safety-features)
