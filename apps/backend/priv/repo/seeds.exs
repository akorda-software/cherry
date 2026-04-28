# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#

alias Snack.Repo
alias Snack.Dating.Tag

tags = [
  %{slug: "music", label: "Música", category: "interests", sort_order: 1},
  %{slug: "sports", label: "Deportes", category: "interests", sort_order: 2},
  %{slug: "travel", label: "Viajar", category: "interests", sort_order: 3},
  %{slug: "food", label: "Gastronomía", category: "interests", sort_order: 4},
  %{slug: "reading", label: "Lectura", category: "interests", sort_order: 5},
  %{slug: "gaming", label: "Videojuegos", category: "interests", sort_order: 6},
  %{slug: "movies", label: "Cine y series", category: "interests", sort_order: 7},
  %{slug: "nature", label: "Naturaleza", category: "interests", sort_order: 8},
  %{slug: "fitness", label: "Fitness", category: "lifestyle", sort_order: 9},
  %{slug: "yoga", label: "Yoga", category: "lifestyle", sort_order: 10},
  %{slug: "meditation", label: "Meditación", category: "lifestyle", sort_order: 11},
  %{slug: "vegan", label: "Vegano/a", category: "lifestyle", sort_order: 12},
  %{slug: "party", label: "Salir de fiesta", category: "social", sort_order: 13},
  %{slug: "chill", label: "Plan tranquilo", category: "social", sort_order: 14},
  %{slug: "dogs", label: "Amante de perros", category: "pets", sort_order: 15},
  %{slug: "cats", label: "Amante de gatos", category: "pets", sort_order: 16},
  %{slug: "no_pets", label: "Sin mascotas", category: "pets", sort_order: 17},
  %{slug: "art", label: "Arte", category: "interests", sort_order: 18},
  %{slug: "tech", label: "Tecnología", category: "interests", sort_order: 19},
  %{slug: "dancing", label: "Bailar", category: "interests", sort_order: 20}
]

Enum.each(tags, fn attrs ->
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

IO.puts("Seeded #{length(tags)} tags.")
