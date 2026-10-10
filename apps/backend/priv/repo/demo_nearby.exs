# Perfiles de DEMO alrededor de una cuenta concreta, para probar Descubrir con tu
# propia cuenta de desarrollo. NUNCA se ejecuta fuera de MIX_ENV=dev.
#
#     EMAIL=tu@correo.com COUNT=24 mix run priv/repo/demo_nearby.exs
#
# Lee el perfil, la ubicación y los filtros de EMAIL y crea COUNT perfiles
# sintéticos (`cerca-<n>@demo.cherry.dev`) a 2–30 km, compatibles con esa cuenta
# en los dos sentidos: de los géneros y edades que filtra, que a su vez quieren
# ver su género y edad, con una intención compatible y sin bloquear sus etiquetas.
# Varios comparten etiquetas con ella para que se vea «en común».
#
# Idempotente: re-ejecutarlo recoloca los perfiles alrededor de la ubicación
# actual de EMAIL y borra sus interacciones (swipes, matches, bloqueos, reportes),
# así vuelven a salir en Descubrir. Retratos de https://i.pravatar.cc y fotos de
# ambiente de https://picsum.photos (solo enlazadas), igual que `demo_seeds.exs`.

unless Mix.env() == :dev do
  Mix.raise("demo_nearby.exs solo puede ejecutarse en dev (MIX_ENV=#{Mix.env()}).")
end

unless String.ends_with?(Cherry.Repo.config()[:database] || "", "_dev") do
  Mix.raise("demo_nearby.exs solo puede ejecutarse contra una base de datos *_dev.")
end

Logger.configure(level: :warning)

defmodule Cherry.DemoNearby do
  @moduledoc false

  import Ecto.Query

  alias Cherry.Accounts
  alias Cherry.Accounts.User
  alias Cherry.Dating

  alias Cherry.Dating.{
    DiscoveryPreference,
    Match,
    Profile,
    ProfilePhoto,
    Report,
    SwipeAction,
    Tag,
    UserBlock
  }

  alias Cherry.Repo

  # Retratos de pravatar clasificados a mano por género aparente (ver demo_seeds.exs).
  @portraits %{
    "woman" => [
      5,
      9,
      10,
      16,
      19,
      20,
      21,
      23,
      24,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      34,
      36,
      38,
      41,
      43,
      47,
      49
    ],
    "man" => [
      3,
      6,
      8,
      11,
      13,
      14,
      15,
      18,
      33,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      62,
      64,
      67,
      68
    ],
    "non_binary" => [22, 25, 35, 39, 48, 61]
  }

  @names %{
    "woman" =>
      ~w(Marta Laura Paula Andrea Clara Irene Sara Elena Nuria Carla Lidia Alba Silvia Rocío Aitana Vega Julia Inés Maite Ariadna Judit Olga Raquel Eva),
    "man" =>
      ~w(Jaume Pau Vicent Marc Toni Nacho Raúl Óscar Sergi Iván Hugo Álex Borja Dani Rubén Joan Pablo Miguel Andrés Quique Carlos Rafa Lluís David),
    "non_binary" => ~w(Sam Noa Río Cris Ari Eli Kai Nico Leo Mar Jess Dani)
  }

  @bios [
    "Diseñadora de interiores. Fin de semana perfecto: mercado de Russafa por la mañana y playa hasta que se vaya el sol.",
    "Trabajo en un estudio de sonido y colecciono vinilos que no me caben en casa. Si sabes de un buen concierto pequeño, ya tenemos tema.",
    "Enfermera de turnos imposibles. Cuando libro, bici por el Turia y horchata sin culpa.",
    "Programo de día y cocino de noche. Mi paella no es tradicional y lo sé, pero está buenísima.",
    "Profe de yoga que también ve realities. La vida es equilibrio.",
    "Me mudé hace un año y aún descubro rincones nuevos. Enséñame tu sitio favorito y yo te enseño el mío.",
    "Fotógrafa aficionada, runner a ratos y fan de las sobremesas largas. Poco de mensajes eternos, más de quedar.",
    "Arquitecta. Me paro a mirar edificios feos y bonitos por igual. Café solo, sin azúcar, y planes sin prisa.",
    "Hago escalada en El Chorro cuando puedo y en rocódromo cuando no. Busco a alguien con ganas de moverse.",
    "Traductora freelance: hablo cuatro idiomas y aún así no sé explicar por qué me gustan tanto los perros ajenos.",
    "Ilustradora. Me paso el día dibujando y la noche buscando dónde cenar bien. Tú eliges el sitio, yo el postre.",
    "Veterinaria y con dos gatos que mandan en casa. Me encantan los planes de manta y peli, pero también una buena fiesta.",
    "Bióloga marina reconvertida en data analyst. Echo de menos bucear; si buceas, ganas puntos.",
    "Barista y estudiante de psicología. Hago el mejor flat white de la ciudad, sin exagerar.",
    "Me gustan los festivales, los juegos de mesa y los domingos sin alarma. Directa y con bastante humor negro.",
    "Periodista. Pregunto mucho, escucho más. Me apunto a cualquier ruta en furgo que acabe en una cala.",
    "Chef en un restaurante del Carmen. Si me invitas a cenar, prometo no criticar la comida. Mucho.",
    "Hago cerámica y tengo más tazas de las que necesito. Busco a alguien con quien estrenarlas.",
    "Abogada de día, bajista en un grupo de versiones de noche. Tenemos concierto el mes que viene.",
    "Ingeniera. Monto muebles sin instrucciones y me sale bien casi siempre. Casi.",
    "Viajo siempre que puedo con una mochila pequeña. Próximo destino por decidir: ¿propuestas?",
    "Me encanta el cine de terror, el vermut de los sábados y el mar en invierno.",
    "Entreno a un equipo de vóley playa y tengo la piel morena todo el año. Plan ideal: partido y cervezas.",
    "Estudio un máster y trabajo en una librería. Te recomiendo un libro según tu signo, aunque no crea en ellos."
  ]

  def run do
    email = System.get_env("EMAIL") || Mix.raise("Falta EMAIL=<correo de tu cuenta>")
    count = String.to_integer(System.get_env("COUNT", "24"))
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    user = Repo.get_by(User, email: email) || Mix.raise("No existe la cuenta #{email}")
    me = Repo.get_by(Profile, user_id: user.id) || Mix.raise("#{email} no tiene perfil")

    prefs =
      Repo.get_by(DiscoveryPreference, profile_id: me.id) ||
        Mix.raise("#{email} no tiene filtros")

    {lat0, lng0} = my_location(me.id)
    my_age = age(me.birth_date)
    my_intents = me.looking_for || ["go_with_the_flow"]

    genders =
      [
        {"woman", prefs.show_women},
        {"man", prefs.show_men},
        {"non_binary", prefs.show_non_binary}
      ]
      |> Enum.filter(&elem(&1, 1))
      |> Enum.map(&elem(&1, 0))

    if genders == [], do: Mix.raise("#{email} no filtra ningún género")

    catalog = Repo.all(from t in Tag, where: t.is_active, select: {t.id, t.slug})
    my_tag_ids = me.id |> Dating.get_profile_tags() |> MapSet.new(& &1.id)
    my_blocked = me.id |> Dating.get_profile_blocked_tags() |> MapSet.new(& &1.id)
    usable = Enum.reject(catalog, fn {id, _} -> MapSet.member?(my_blocked, id) end)
    shared_pool = Enum.filter(usable, fn {id, _} -> MapSet.member?(my_tag_ids, id) end)

    profiles =
      for n <- 1..count do
        gender = Enum.at(genders, rem(n - 1, length(genders)))
        # Índice dentro de su género: nombres y retratos no se repiten entre vecinos.
        i = div(n - 1, length(genders))
        age = Enum.random(max(prefs.age_min, 18)..max(prefs.age_min, prefs.age_max))
        km = 2 + rem(n * 7, 29)
        bearing = rem(n * 137, 360) * :math.pi() / 180
        latitude = lat0 + km / 111.32 * :math.cos(bearing)
        longitude = lng0 + km / (111.32 * :math.cos(lat0 * :math.pi() / 180)) * :math.sin(bearing)

        persona = %{
          key: "cerca-#{n}",
          name: Enum.at(@names[gender], rem(i, length(@names[gender]))),
          gender: gender,
          age: age,
          intents: compatible_intents(my_intents, n),
          # Quieren ver el género y la edad de EMAIL (y alguno más, para que sea creíble).
          show: Enum.uniq([me.gender | Enum.take_random(~w(woman man non_binary), 1)]),
          ages: {max(18, min(my_age, age) - 5), max(my_age, age) + 6},
          coords: {Float.round(latitude, 5), Float.round(longitude, 5)},
          tags: pick_tags(shared_pool, usable, n),
          portrait: Enum.at(@portraits[gender], rem(i, length(@portraits[gender]))),
          bio: Enum.at(@bios, rem(n - 1, length(@bios)))
        }

        upsert(persona, now)
      end

    ids = Enum.map(profiles, & &1.id)
    Repo.delete_all(from m in Match, where: m.profile_a_id in ^ids or m.profile_b_id in ^ids)

    Repo.delete_all(
      from s in SwipeAction, where: s.actor_profile_id in ^ids or s.target_profile_id in ^ids
    )

    Repo.delete_all(
      from b in UserBlock, where: b.actor_profile_id in ^ids or b.target_profile_id in ^ids
    )

    Repo.delete_all(
      from r in Report, where: r.reporter_profile_id in ^ids or r.target_profile_id in ^ids
    )

    IO.puts("""

    #{length(profiles)} perfiles cerca de #{email} (#{Float.round(lat0, 3)}, #{Float.round(lng0, 3)}), #{Enum.join(genders, ", ")}.
    Abre Descubrir (o tira hacia abajo para recargar).
    """)
  end

  # Cada intención ve la suya y «a ver qué pasa»; relación y casual nunca se cruzan.
  defp compatible_intents(my_intents, n) do
    base = Enum.at(my_intents, rem(n, length(my_intents)))

    case rem(n, 3) do
      0 -> ["go_with_the_flow"]
      1 -> [base]
      _ -> Enum.uniq([base, "go_with_the_flow"])
    end
  end

  defp pick_tags(shared_pool, usable, n) do
    shared = Enum.take_random(shared_pool, min(length(shared_pool), rem(n, 4)))
    rest = Enum.take_random(usable -- shared, 5 - length(shared) + rem(n, 2))
    Enum.map(shared ++ rest, &elem(&1, 0)) |> Enum.uniq() |> Enum.take(8)
  end

  defp upsert(persona, now) do
    email = "#{persona.key}@demo.cherry.dev"

    user =
      case Repo.get_by(User, email: email) do
        %User{} = user ->
          user

        nil ->
          {:ok, user} = Accounts.create_user(%{email: email, display_name: persona.name})
          user
      end

    profile =
      (Repo.get_by(Profile, user_id: user.id) || %Profile{})
      |> Profile.changeset(%{
        user_id: user.id,
        display_name: persona.name,
        birth_date:
          Date.utc_today()
          |> Date.shift(year: -persona.age)
          |> Date.add(-(30 + :erlang.phash2(persona.key, 300))),
        gender: persona.gender,
        looking_for: persona.intents,
        bio: persona.bio,
        is_complete: true,
        is_paused: false,
        is_discoverable: true,
        deleted_at: nil
      })
      |> Repo.insert_or_update!()

    {age_min, age_max} = persona.ages

    {:ok, _} =
      Dating.upsert_discovery_preference(profile.id, %{
        age_min: age_min,
        age_max: min(age_max, 100),
        distance_km: 50,
        show_men: "man" in persona.show,
        show_women: "woman" in persona.show,
        show_non_binary: "non_binary" in persona.show,
        compatible_only: false,
        discovery_mode: :swipe
      })

    {latitude, longitude} = persona.coords

    {:ok, _} =
      Dating.upsert_location(%{
        "profile_id" => profile.id,
        "latitude" => latitude,
        "longitude" => longitude,
        "accuracy_meters" => 50,
        "recorded_at" => now
      })

    {:ok, _} = Dating.set_profile_blocked_tags(profile.id, [])
    {:ok, _} = Dating.set_profile_tags(profile.id, persona.tags)

    Repo.delete_all(from ph in ProfilePhoto, where: ph.profile_id == ^profile.id)

    urls =
      ["https://i.pravatar.cc/800?img=#{persona.portrait}"] ++
        for(n <- 2..3, do: "https://picsum.photos/seed/cherry-#{persona.key}-#{n}/800/1000")

    urls
    |> Enum.with_index(1)
    |> Enum.each(fn {url, position} ->
      {:ok, _} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "demo/#{persona.key}/#{position}",
          url: url,
          position: position,
          is_active: true
        })
    end)

    Repo.query!(
      "UPDATE profiles SET completed_at = $2, last_active_at = $3 WHERE id = $1",
      [
        Ecto.UUID.dump!(profile.id),
        DateTime.add(now, -3, :day),
        DateTime.add(now, -Enum.random(5..600), :minute)
      ]
    )

    profile
  end

  defp my_location(profile_id) do
    %{rows: rows} =
      Repo.query!(
        "SELECT ST_Y(coordinates::geometry), ST_X(coordinates::geometry) FROM profile_locations WHERE profile_id = $1",
        [Ecto.UUID.dump!(profile_id)]
      )

    case rows do
      [[latitude, longitude]] -> {latitude, longitude}
      _ -> Mix.raise("La cuenta no tiene ubicación: compártela desde la app primero")
    end
  end

  defp age(birth_date) do
    today = Date.utc_today()
    years = today.year - birth_date.year
    if {today.month, today.day} < {birth_date.month, birth_date.day}, do: years - 1, else: years
  end
end

Cherry.DemoNearby.run()
