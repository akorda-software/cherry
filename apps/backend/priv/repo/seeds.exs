# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#

import Ecto.Query

alias Cherry.Repo
alias Cherry.Dating.Tag

# The canonical dating tag catalog. Slugs are stable identifiers (English),
# labels are Spanish for display. Re-running this seed reactivates every tag
# listed here and deactivates any tag no longer in the set.
tags = [
  # ── Intereses y hobbies ──────────────────────────────────────────────
  %{slug: "music", label: "Música", category: "interests", sort_order: 1},
  %{slug: "cinema", label: "Cine y series", category: "interests", sort_order: 2},
  %{slug: "reading", label: "Lectura", category: "interests", sort_order: 3},
  %{slug: "gaming", label: "Videojuegos", category: "interests", sort_order: 4},
  %{slug: "travel", label: "Viajar", category: "interests", sort_order: 5},
  %{slug: "cooking", label: "Cocinar", category: "interests", sort_order: 6},
  %{slug: "art", label: "Arte y diseño", category: "interests", sort_order: 7},
  %{slug: "photography", label: "Fotografía", category: "interests", sort_order: 8},
  %{slug: "dancing", label: "Bailar", category: "interests", sort_order: 9},
  %{slug: "languages", label: "Idiomas", category: "interests", sort_order: 10},
  # ── Vida activa y naturaleza ─────────────────────────────────────────
  %{slug: "fitness", label: "Fitness y gimnasio", category: "active", sort_order: 11},
  %{slug: "running", label: "Running", category: "active", sort_order: 12},
  %{slug: "yoga", label: "Yoga", category: "active", sort_order: 13},
  %{slug: "cycling", label: "Ciclismo", category: "active", sort_order: 14},
  %{slug: "hiking", label: "Senderismo y montaña", category: "active", sort_order: 15},
  %{slug: "team_sports", label: "Deporte de equipo", category: "active", sort_order: 16},
  %{slug: "nature", label: "Naturaleza", category: "active", sort_order: 17},
  %{slug: "adventure", label: "Deportes de aventura", category: "active", sort_order: 18},
  # ── Estilo de vida y hábitos ─────────────────────────────────────────
  %{slug: "party", label: "Salir de fiesta", category: "lifestyle", sort_order: 19},
  %{slug: "chill", label: "Plan tranquilo", category: "lifestyle", sort_order: 20},
  %{slug: "night_owl", label: "Trasnochar", category: "lifestyle", sort_order: 21},
  %{slug: "foodie", label: "Foodie", category: "lifestyle", sort_order: 22},
  %{slug: "coffee", label: "Amante del café", category: "lifestyle", sort_order: 23},
  %{slug: "vegan", label: "Vegano/a", category: "lifestyle", sort_order: 24},
  %{slug: "vegetarian", label: "Vegetariano/a", category: "lifestyle", sort_order: 25},
  %{slug: "smoker", label: "Fumador/a", category: "lifestyle", sort_order: 26},
  %{slug: "cannabis", label: "Cannabis", category: "lifestyle", sort_order: 27},
  %{slug: "sober", label: "Sin alcohol", category: "lifestyle", sort_order: 28},
  # ── Valores y creencias ──────────────────────────────────────────────
  %{slug: "meditation", label: "Meditación", category: "values", sort_order: 29},
  %{slug: "spirituality", label: "Espiritualidad", category: "values", sort_order: 30},
  %{slug: "environmentalist", label: "Ecologista", category: "values", sort_order: 31},
  %{slug: "feminist", label: "Feminista", category: "values", sort_order: 32},
  %{slug: "family_oriented", label: "Familiar", category: "values", sort_order: 33},
  %{slug: "volunteer", label: "Voluntariado y activismo", category: "values", sort_order: 34},
  # ── Personalidad ─────────────────────────────────────────────────────
  %{slug: "introvert", label: "Introvertido/a", category: "personality", sort_order: 35},
  %{slug: "extrovert", label: "Extrovertido/a", category: "personality", sort_order: 36},
  %{slug: "ambitious", label: "Ambicioso/a", category: "personality", sort_order: 37},
  %{slug: "creative", label: "Creativo/a", category: "personality", sort_order: 38},
  %{slug: "curious", label: "Curioso/a", category: "personality", sort_order: 39},
  # ── Mascotas ─────────────────────────────────────────────────────────
  %{slug: "dogs", label: "Amante de perros", category: "pets", sort_order: 40},
  %{slug: "cats", label: "Amante de gatos", category: "pets", sort_order: 41},
  %{slug: "no_pets", label: "Sin mascotas", category: "pets", sort_order: 42},
  # ── Relación y familia ───────────────────────────────────────────────
  %{slug: "has_kids", label: "Tengo hijos", category: "relationship", sort_order: 43},
  %{slug: "wants_kids", label: "Quiero tener hijos", category: "relationship", sort_order: 44},
  %{slug: "childfree", label: "No quiero hijos", category: "relationship", sort_order: 45},
  %{slug: "monogamous", label: "Monogamia", category: "relationship", sort_order: 46},
  %{
    slug: "open_relationship",
    label: "Relación abierta",
    category: "relationship",
    sort_order: 47
  }
]

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
