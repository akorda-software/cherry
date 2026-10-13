# Contribuir a Cherry

Gracias por querer echar una mano. Cherry es de quien lo hace: tu código sigue
siendo tuyo y lo compartes con todo el mundo bajo la misma licencia que el
resto.

## Antes de empezar

- **Errores e ideas:** abre un issue. Si es un fallo de seguridad o afecta a
  datos personales, no lo publiques: escribe a las personas que mantienen el
  repositorio por privado.
- **Cambios grandes:** coméntalos primero en un issue, para no hacer trabajo que
  luego no encaje.
- **Cómo arrancarlo:** el [README](./README.md) explica el entorno de
  desarrollo y [`docs/`](./docs/README.md) cómo está hecho.

## Cómo enviar un cambio

1. Haz un fork y una rama desde `main`.
2. Escribe pruebas para lo que cambies y deja todo en verde:
   ```bash
   pnpm test:mobile
   cd apps/backend && mix test
   ```
3. Si cambias algo que la documentación explica, actualízala en el mismo cambio.
4. Firma cada commit (ver abajo) y abre un pull request contra `main`.

Los commits van en castellano, en presente y diciendo qué cambia para quien usa
la app, por ejemplo: `fix(mobile): el CAN se ve con el teclado abierto`.

## Firma tus commits (DCO)

No hace falta firmar ningún acuerdo ni ceder derechos. Basta con certificar que
puedes aportar ese código, según el [Developer Certificate of Origin](./DCO).
Para eso, cada commit lleva una línea así:

```
Signed-off-by: Nombre Apellido <correo@ejemplo.com>
```

Git la añade sola con `-s`:

```bash
git commit -s -m "fix(backend): …"
```

Si se te olvidó, corrige el último commit con `git commit --amend -s --no-edit`,
o todos los de tu rama con `git rebase --signoff main`.

Al firmar, aceptas que tu contribución se publique bajo las licencias de Cherry:

- **Código:** [AGPL-3.0](./LICENSE) únicamente, con el
  [permiso adicional para las tiendas de apps](./LICENSE-EXCEPTION.md). Ese
  permiso es lo que deja publicar Cherry en la App Store y Google Play, a ti, a
  nosotros y a cualquier otra instancia.
- **Dibujos y documentación:** además, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es).

Todo el detalle está en [`COPYRIGHT.md`](./COPYRIGHT.md).

## Código de terceros

Si añades una dependencia o copias código de otro proyecto, su licencia tiene
que ser compatible con la AGPL-3.0 (MIT, BSD, Apache-2.0, LGPL, MPL-2.0, GPL-3.0,
AGPL-3.0…) y tiene que quedar indicada. No añadas dependencias pesadas sin
explicar por qué hacen falta.

## Datos personales

Nunca subas datos reales: ni documentos de identidad, ni fotos de personas
reales, ni conversaciones. Las pruebas usan datos inventados.
