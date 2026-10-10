defmodule Cherry.Dating.TagCatalog do
  @moduledoc """
  Catálogo cerrado de etiquetas (52 en 7 categorías). Los slugs son
  identificadores estables (inglés); las etiquetas, en español. `sort_order`
  sigue el orden de la lista.

  `seed!/0` es idempotente: inserta o actualiza cada etiqueta, reactiva las
  listadas y desactiva las que ya no están. Lo usan `priv/repo/seeds.exs`
  (dev/test) y `Cherry.Release.seed/0` / `bin/migrate` (releases y Docker), para
  que una instalación nueva no arranque con el catálogo vacío (nadie podría
  completar el onboarding).
  """

  import Ecto.Query

  alias Cherry.Dating.Tag
  alias Cherry.Repo

  @lock_key :erlang.phash2("cherry.tag_catalog.seed")

  @catalog [
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

  @doc "Entradas del catálogo: `%{slug, emoji, label, category, sort_order}`."
  def entries do
    @catalog
    |> Enum.flat_map(fn {category, entries} ->
      Enum.map(entries, fn {slug, emoji, label} ->
        %{slug: slug, emoji: emoji, label: label, category: category}
      end)
    end)
    |> Enum.with_index(1)
    |> Enum.map(fn {attrs, sort_order} -> Map.put(attrs, :sort_order, sort_order) end)
  end

  @doc """
  Sincroniza el catálogo. Devuelve `%{tags: n, deactivated: n}`. Serializado
  con un advisory lock: varios nodos que arrancan a la vez no chocan.
  """
  def seed! do
    tags = entries()
    active_slugs = Enum.map(tags, & &1.slug)

    {:ok, deactivated} =
      Repo.transaction(fn ->
        Repo.query!("SELECT pg_advisory_xact_lock($1)", [@lock_key])

        Enum.each(tags, fn attrs ->
          attrs = Map.put(attrs, :is_active, true)

          case Repo.get_by(Tag, slug: attrs.slug) do
            nil -> %Tag{} |> Tag.changeset(attrs) |> Repo.insert!()
            existing -> existing |> Tag.changeset(attrs) |> Repo.update!()
          end
        end)

        {deactivated, _} =
          Repo.update_all(
            from(t in Tag, where: t.slug not in ^active_slugs and t.is_active == true),
            set: [is_active: false]
          )

        deactivated
      end)

    %{tags: length(tags), deactivated: deactivated}
  end
end
