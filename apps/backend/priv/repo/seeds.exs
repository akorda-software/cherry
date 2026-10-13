# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Idempotente: se puede re-ejecutar en cualquier entorno (también en prod) para
# sincronizar el catálogo cerrado de etiquetas (`Cherry.Dating.TagCatalog`). En
# releases/Docker lo hace `bin/migrate` (o `bin/seed`). Los datos de demo viven
# aparte en `priv/repo/demo_seeds.exs` (solo dev).

%{tags: tags, deactivated: deactivated} = Cherry.Dating.TagCatalog.seed!()
IO.puts("Seeded #{tags} tags (deactivated #{deactivated} legacy tags).")
