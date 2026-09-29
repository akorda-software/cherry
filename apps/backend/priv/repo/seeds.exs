# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Idempotente: se puede re-ejecutar en cualquier entorno (también en prod) para
# sincronizar el catálogo cerrado de etiquetas. Los datos de demo viven aparte en
# `priv/repo/demo_seeds.exs` (solo dev).

import Ecto.Query

alias Snack.Repo
alias Snack.Dating.Tag

# The canonical dating tag catalog (52 tags). Slugs are stable identifiers
# (English), labels are Spanish for display. `sort_order` follows the list order.
# Re-running this seed reactivates every tag listed here and deactivates any tag
# no longer in the set.
catalog = [
  # ── Intereses y hobbies ──────────────────────────────────────────────
  {"interests",
   [
     {"music", "🎵", "Música"},
     {"cinema", "🎬", "Cine y series"},
     {"reading", "📚", "Lectura"},
     {"gaming", "🎮", "Videojuegos"},
     {"travel", "✈️", "Viajar"},
     {"cooking", "🍳", "Cocinar"},
     {"art", "🎨", "Arte y diseño"},
     {"photography", "📷", "Fotografía"},
     {"dancing", "💃", "Bailar"},
     {"languages", "🗣️", "Idiomas"},
     {"anime", "🍙", "Anime y manga"},
     {"board_games", "🎲", "Juegos de mesa"},
     {"concerts", "🎤", "Conciertos y festivales"}
   ]},
  # ── Vida activa y naturaleza ─────────────────────────────────────────
  {"active",
   [
     {"fitness", "💪", "Fitness y gimnasio"},
     {"running", "🏃", "Running"},
     {"yoga", "🧘", "Yoga"},
     {"cycling", "🚴", "Ciclismo"},
     {"hiking", "🥾", "Senderismo y montaña"},
     {"team_sports", "⚽", "Deporte de equipo"},
     {"nature", "🌿", "Naturaleza"},
     {"adventure", "🧗", "Deportes de aventura"}
   ]},
  # ── Estilo de vida y hábitos ─────────────────────────────────────────
  {"lifestyle",
   [
     {"party", "🎉", "Salir de fiesta"},
     {"chill", "🛋️", "Plan tranquilo"},
     {"night_owl", "🦉", "Trasnochar"},
     {"foodie", "😋", "Foodie"},
     {"coffee", "☕", "Amante del café"},
     {"vegan", "🌱", "Vegano/a"},
     {"vegetarian", "🥕", "Vegetariano/a"},
     {"smoker", "🚬", "Fumador/a"},
     {"cannabis", "🍃", "Cannabis"},
     {"sober", "🧃", "Sin alcohol"},
     {"tattoos", "🖋️", "Tatuajes"}
   ]},
  # ── Valores y creencias ──────────────────────────────────────────────
  {"values",
   [
     {"meditation", "🕯️", "Meditación"},
     {"spirituality", "✨", "Espiritualidad"},
     {"astrology", "🔮", "Astrología"},
     {"environmentalist", "🌍", "Ecologista"},
     {"feminist", "💜", "Feminista"},
     {"family_oriented", "🏡", "Familiar"},
     {"volunteer", "🤝", "Voluntariado y activismo"}
   ]},
  # ── Personalidad ─────────────────────────────────────────────────────
  {"personality",
   [
     {"introvert", "🐢", "Introvertido/a"},
     {"extrovert", "🦜", "Extrovertido/a"},
     {"ambitious", "🚀", "Ambicioso/a"},
     {"creative", "💡", "Creativo/a"},
     {"curious", "🔍", "Curioso/a"}
   ]},
  # ── Mascotas ─────────────────────────────────────────────────────────
  {"pets",
   [
     {"dogs", "🐶", "Amante de perros"},
     {"cats", "🐱", "Amante de gatos"},
     {"no_pets", "🙅", "Sin mascotas"}
   ]},
  # ── Relación y familia ───────────────────────────────────────────────
  {"relationship",
   [
     {"has_kids", "👶", "Tengo hijos"},
     {"wants_kids", "🍼", "Quiero tener hijos"},
     {"childfree", "🎈", "No quiero hijos"},
     {"monogamous", "💑", "Monogamia"},
     {"open_relationship", "🔓", "Relación abierta"}
   ]}
]

tags =
  catalog
  |> Enum.flat_map(fn {category, entries} ->
    Enum.map(entries, fn {slug, emoji, label} ->
      %{slug: slug, emoji: emoji, label: label, category: category}
    end)
  end)
  |> Enum.with_index(1)
  |> Enum.map(fn {attrs, sort_order} -> Map.put(attrs, :sort_order, sort_order) end)

active_slugs = Enum.map(tags, & &1.slug)

Enum.each(tags, fn attrs ->
  attrs = Map.put(attrs, :is_active, true)

  case Repo.get_by(Tag, slug: attrs.slug) do
    nil ->
      %Tag{}
      |> Tag.changeset(attrs)
      |> Repo.insert!()

    existing ->
      existing
      |> Tag.changeset(attrs)
      |> Repo.update!()
  end
end)

{deactivated, _} =
  Repo.update_all(
    from(t in Tag, where: t.slug not in ^active_slugs and t.is_active == true),
    set: [is_active: false]
  )

IO.puts("Seeded #{length(tags)} tags (deactivated #{deactivated} legacy tags).")
