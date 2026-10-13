# Datos de DEMO para desarrollo. NUNCA se ejecuta fuera de MIX_ENV=dev.
#
#     DATABASE_URL=ecto://postgres:postgres@localhost:5510/cherry_dev mix run priv/repo/demo_seeds.exs
#
# Qué crea (idempotente: re-ejecutarlo restaura el mismo escenario sin duplicar):
#
#   * El catálogo de etiquetas (evalúa `seeds.exs`).
#   * 53 perfiles sintéticos completos y descubribles a 1–40 km de Madrid (o de
#     DEMO_CENTER="lat,lng" si se define: todo el escenario se traslada allí)
#     (`<nombre>@demo.cherry.dev`), de 20 a 45 años, hombres, mujeres y personas
#     no binarias, con intenciones, preferencias, etiquetas y bios variadas.
#   * `demo@cherry.dev` — Lucía, 29, busca relación; interesada en hombres y
#     personas no binarias. Tiene 8 likes recibidos sin responder, 5 matches
#     (2 sin mensajes y 3 conversaciones, dos con mensajes sin leer) y algunos
#     swipes hechos.
#   * `demo2@cherry.dev` — Hugo, 33, «a ver qué pasa»; perfil sencillo y sin
#     interacciones, para probar matches en directo entre dos sesiones.
#
# Entrar: `POST /api/auth/dev/test-login` con `{"email": "demo@cherry.dev"}` (vale
# cualquier email de esta lista, p. ej. `pablo@demo.cherry.dev`).
#
# Al re-ejecutarlo se borran y recrean las fotos, etiquetas y TODAS las
# interacciones (swipes, matches, mensajes, bloqueos, reportes) en las que
# participa alguna cuenta demo. Los mensajes se crean con `Cherry.Dating.send_message/1`
# para respetar el cifrado en reposo.
#
# DATOS SINTÉTICOS SOLO PARA DEV: personas, nombres, bios y conversaciones son
# inventados. Los retratos son imágenes de muestra de https://i.pravatar.cc
# (clasificadas a mano por género aparente; se excluyeron menores, personas
# mayores y caras reconocibles) y las fotos de ambiente vienen de
# https://picsum.photos. Solo se enlazan, no se descargan ni se redistribuyen.

unless Mix.env() == :dev do
  Mix.raise("demo_seeds.exs solo puede ejecutarse en dev (MIX_ENV=#{Mix.env()}).")
end

# Segunda barrera: aunque MIX_ENV=dev, nunca contra una BD que no sea de dev
# (un DATABASE_URL de prod exportado por error en la shell).
demo_database = Cherry.Repo.config()[:database] || ""

unless String.ends_with?(demo_database, "_dev") do
  Mix.raise(
    "demo_seeds.exs solo puede ejecutarse contra una base de datos *_dev (actual: #{inspect(demo_database)})."
  )
end

# Sin el volcado SQL de dev: solo avisos y el resumen final.
Logger.configure(level: :warning)

Code.eval_file(Path.join(__DIR__, "seeds.exs"))

defmodule Cherry.DemoSeeds.SilentPush do
  @moduledoc false
  # El escenario genera matches y mensajes: que no lleguen pushes reales a
  # dispositivos de desarrollo registrados con estas cuentas.
  def send_messages(messages, _opts),
    do: {:ok, Enum.map(messages, fn _ -> %{"status" => "ok"} end)}
end

defmodule Cherry.DemoSeeds do
  @moduledoc false

  import Ecto.Query

  alias Cherry.Accounts
  alias Cherry.Accounts.User
  alias Cherry.Dating
  alias Cherry.Dating.{Match, Message, Profile, ProfilePhoto, Report, SwipeAction, Tag, UserBlock}
  alias Cherry.Repo

  @madrid {40.4168, -3.7038}

  # DEMO_CENTER="lat,lng" moves the whole scenario (bios still talk about Madrid).
  defp center do
    case System.get_env("DEMO_CENTER", "") |> String.split(",", trim: true) do
      [] ->
        @madrid

      [lat, lng] ->
        with {lat, ""} <- Float.parse(String.trim(lat)),
             {lng, ""} <- Float.parse(String.trim(lng)),
             true <- lat >= -90 and lat <= 90 and lng >= -180 and lng <= 180 do
          {lat, lng}
        else
          _ -> Mix.raise("DEMO_CENTER debe ser \"lat,lng\", p. ej. 48.8566,2.3522")
        end

      _other ->
        Mix.raise("DEMO_CENTER debe ser \"lat,lng\", p. ej. 48.8566,2.3522")
    end
  end

  # ── Personas ───────────────────────────────────────────────────────────
  #
  # show: a quién quiere ver (:men, :women, :nb). km: distancia aproximada a Sol.
  # portrait: N de https://i.pravatar.cc/800?img=N. extra: fotos de ambiente (1–3).
  # active: minutos desde la última actividad. completed: días desde que completó.

  def main_personas do
    [
      %{
        key: "lucia",
        email: "demo@cherry.dev",
        name: "Lucía",
        gender: "woman",
        age: 29,
        intent: "relationship",
        show: [:men, :nb],
        ages: {26, 38},
        distance: 50,
        mode: :swipe,
        coords: {40.4089, -3.7005},
        tags: ~w(cooking hiking dogs coffee board_games concerts travel curious),
        blocked: ~w(smoker open_relationship),
        portrait: 45,
        extra: 3,
        active: 0,
        completed: 40,
        bio:
          "Cocino las croquetas de mi abuela mejor que ella (que no se entere). Busco a alguien con quien subir a la sierra un domingo y perder al Catán sin enfadarse. Tofu, mi perro, tiene la última palabra."
      },
      %{
        key: "hugo",
        email: "demo2@cherry.dev",
        name: "Hugo",
        gender: "man",
        age: 33,
        intent: "go_with_the_flow",
        show: [:women],
        ages: {25, 40},
        distance: 25,
        mode: :swipe,
        coords: {40.4340, -3.7040},
        tags: ~w(cinema running foodie cats chill),
        blocked: [],
        portrait: 12,
        extra: 1,
        active: 0,
        completed: 12,
        bio:
          "Programador de día, cocinero de pasta a deshoras. Me apunto a un cine en versión original o a un paseo sin rumbo por el Retiro."
      }
    ]
  end

  def personas do
    men() ++ women() ++ non_binary()
  end

  defp men do
    [
      p(
        "pablo",
        "Pablo",
        "man",
        31,
        "relationship",
        [:women],
        {25, 36},
        3,
        25,
        ~w(cooking cats foodie cinema board_games monogamous),
        [],
        60,
        2,
        25,
        30,
        "Profe de Historia en un instituto de Carabanchel. Hago unas bravas que merecen monumento y tengo una gata, Croqueta, que decide mi agenda. Busco a alguien con quien discutir qué serie ver sin llegar a las manos."
      ),
      p(
        "alvaro",
        "Álvaro",
        "man",
        33,
        "relationship",
        [:women],
        {26, 38},
        6,
        25,
        ~w(running travel languages coffee ambitious wants_kids),
        [],
        52,
        3,
        90,
        21,
        "Ingeniero de caminos y corredor de fondo (de sofá también). He dado tantas vueltas al Retiro que los patos ya me saludan. Me encantaría encontrar a alguien con quien viajar sin prisa."
      ),
      p(
        "iker",
        "Íker",
        "man",
        28,
        "relationship",
        [:women, :nb],
        {24, 34},
        4,
        25,
        ~w(music concerts dancing extrovert dogs),
        [],
        15,
        2,
        45,
        16,
        "Bilbaíno en Madrid desde hace cinco años y todavía echo de menos el txakoli. Toco la guitarra fatal pero con mucha ilusión. Mi perra Lúa y yo buscamos compañía para conciertos pequeñitos."
      ),
      p(
        "diego",
        "Diego",
        "man",
        34,
        "go_with_the_flow",
        [:women],
        {27, 40},
        8,
        50,
        ~w(concerts music board_games night_owl creative photography),
        [],
        55,
        3,
        300,
        27,
        "Técnico de sonido: he visto más conciertos desde detrás del escenario que desde el público. Colecciono vinilos y juegos de mesa con demasiadas piezas. A ver qué pasa, pero con buena música de fondo."
      ),
      p(
        "sergio",
        "Sergio",
        "man",
        30,
        "relationship",
        [:women],
        {25, 35},
        18,
        50,
        ~w(hiking nature photography dogs environmentalist),
        ~w(smoker),
        11,
        3,
        120,
        9,
        "Agente forestal en Guadarrama. Distingo un buitre leonado de uno negro a dos kilómetros, pero sigo sin saber doblar una sábana bajera. Busco compañera de rutas y de vida."
      ),
      p(
        "ruben",
        "Rubén",
        "man",
        29,
        "relationship",
        [:women],
        {24, 34},
        2,
        25,
        ~w(cooking foodie travel coffee family_oriented),
        [],
        53,
        2,
        35,
        50,
        "Cocinero en un restaurante de Malasaña. En mi día libre lo que más me apetece es... cocinar para alguien. Si te gusta el picante ya tenemos tema de conversación para rato."
      ),
      p(
        "nacho",
        "Nacho",
        "man",
        35,
        "relationship",
        [:women],
        {28, 42},
        5,
        25,
        ~w(reading cinema chill coffee introvert cats),
        ~w(party),
        68,
        2,
        600,
        70,
        "Librero. Te recomiendo un libro según tu signo, tu estado de ánimo o tu última ruptura. Soy más de plan tranquilo que de discoteca y hago un café de puchero que resucita a cualquiera."
      ),
      p(
        "marcos",
        "Marcos",
        "man",
        32,
        "relationship",
        [:women],
        {25, 38},
        9,
        50,
        ~w(cycling fitness travel languages curious),
        [],
        14,
        3,
        200,
        14,
        "Voy en bici a todas partes, incluso cuesta arriba por la calle Toledo (sufriendo, eso sí). Hablo cuatro idiomas y en ninguno sé decir que no a un plan de tapas."
      ),
      p(
        "samuel",
        "Samuel",
        "man",
        27,
        "relationship",
        [:women],
        {22, 32},
        12,
        50,
        ~w(gaming anime board_games introvert creative),
        [],
        33,
        2,
        15,
        2,
        "Diseño videojuegos indie. Mi comida favorita es el onigiri y mi personaje favorito, el que siempre se sacrifica por el grupo. Prometo dejarte ganar al Mario Kart... la primera vez."
      ),
      p(
        "javi",
        "Javi",
        "man",
        26,
        "relationship",
        [:women],
        {22, 32},
        7,
        25,
        ~w(team_sports running party extrovert dogs),
        [],
        8,
        2,
        50,
        11,
        "Juego al fútbol sala los martes y pierdo con mucha dignidad. Soy de los que se aprenden el nombre del camarero y el de su perro. Busco a alguien que se ría fuerte, aunque sea de mí."
      ),
      p(
        "gonzalo",
        "Gonzalo",
        "man",
        36,
        "relationship",
        [:women],
        {28, 42},
        11,
        50,
        ~w(art photography travel creative coffee wants_kids),
        [],
        59,
        3,
        400,
        33,
        "Arquitecto con debilidad por los edificios feos que nadie mira. Te llevo de ruta por el Madrid más raro y luego a por un bocata de calamares, que es lo que se hace aquí."
      ),
      p(
        "raul",
        "Raúl",
        "man",
        34,
        "relationship",
        [:women],
        {26, 38},
        22,
        50,
        ~w(fitness ambitious travel foodie),
        ~w(cannabis),
        3,
        2,
        800,
        45,
        "Fisio de día, pádel por la tarde y miniseries británicas por la noche. Te puedo arreglar la espalda, pero no el disgusto por el final de tu serie favorita."
      ),
      p(
        "mario",
        "Mario",
        "man",
        29,
        "relationship",
        [:women, :nb],
        {24, 35},
        14,
        50,
        ~w(music languages travel curious vegetarian),
        [],
        56,
        2,
        25,
        1,
        "Traductor de alemán, así que sé decir «te echo de menos» con una sola palabra de veinte letras. Vegetariano, pero defiendo la tortilla con cebolla con mi vida."
      ),
      p(
        "hector",
        "Héctor",
        "man",
        34,
        "relationship",
        [:women],
        {27, 40},
        27,
        50,
        ~w(hiking adventure nature meditation no_pets),
        [],
        13,
        3,
        1440,
        60,
        "Escalo los fines de semana y el resto del tiempo trabajo en una ONG de vivienda. Madrugo sin quejarme, que ya es algo. Busco a alguien que se apunte a ver amanecer en Peñalara."
      ),
      p(
        "jorge",
        "Jorge",
        "man",
        31,
        "go_with_the_flow",
        [:women],
        {25, 38},
        4,
        25,
        ~w(cinema night_owl chill cats creative),
        [],
        57,
        2,
        70,
        19,
        "Montador de cine. Veo las pelis a velocidad normal, lo juro."
      ),
      p(
        "adrian",
        "Adrián",
        "man",
        26,
        "go_with_the_flow",
        [:women, :nb],
        {21, 33},
        2,
        10,
        ~w(dancing party music extrovert tattoos),
        [],
        54,
        2,
        130,
        8,
        "Salsa los jueves, tatuajes nuevos cada verano y puntualidad británica siempre."
      ),
      p(
        "unai",
        "Unai",
        "man",
        33,
        "go_with_the_flow",
        [:women],
        {26, 40},
        16,
        50,
        ~w(cycling nature coffee curious environmentalist),
        [],
        67,
        3,
        2000,
        25,
        "Biólogo marino atrapado en Madrid, a 300 km del mar más cercano. Lo compenso yendo al acuario más de lo razonable. Me encanta aprender cosas nuevas: enséñame algo."
      ),
      p(
        "oscar",
        "Óscar",
        "man",
        38,
        "casual",
        [:women],
        {25, 40},
        3,
        25,
        ~w(party night_owl smoker foodie),
        [],
        18,
        1,
        20,
        90,
        "Relaciones públicas de un bar de jazz en Huertas. Nada serio de momento; sí buenas conversaciones hasta las tantas."
      ),
      p(
        "tomas",
        "Tomás",
        "man",
        41,
        ~w(meet_people go_with_the_flow),
        [:men, :women, :nb],
        {30, 50},
        19,
        50,
        ~w(board_games reading cooking has_kids chill),
        [],
        50,
        2,
        3000,
        120,
        "Padre de dos adolescentes que me consideran muy poco guay (tienen razón). Organizo partidas de rol los viernes y hago el mejor cocido del barrio. Busco gente para quedar sin agobios."
      ),
      p(
        "luis",
        "Luis",
        "man",
        27,
        "casual",
        [:men],
        {22, 35},
        6,
        25,
        ~w(fitness party dancing smoker extrovert),
        [],
        51,
        3,
        10,
        6,
        "Opositor a bombero de día y reina del karaoke de noche. Si me ves corriendo por Madrid Río no es por deporte, es que llego tarde. Busco algo sin etiquetas (salvo las de esta app)."
      ),
      p(
        "kike",
        "Kike",
        "man",
        42,
        "casual",
        [:women, :nb],
        {28, 45},
        10,
        50,
        ~w(music concerts open_relationship night_owl art),
        [],
        6,
        2,
        240,
        38,
        "Músico de sesión: he tocado en discos que seguro has escuchado sin saberlo. Relación abierta y honesta, que la sinceridad también es sexy. Invito a un vermú a quien adivine mi canción favorita."
      ),
      p(
        "ivan",
        "Iván",
        "man",
        35,
        "meet_people",
        [:men, :women],
        {25, 45},
        13,
        50,
        ~w(languages travel volunteer curious),
        ~w(dogs),
        58,
        2,
        500,
        17,
        "Recién llegado de Valencia. Profe de inglés y voluntario en un comedor social. Alérgico a los perros (lo siento de verdad, no es personal). Busco gente para intercambio de idiomas y cañas."
      ),
      p(
        "bruno",
        "Bruno",
        "man",
        24,
        "meet_people",
        [:men, :nb],
        {20, 30},
        1,
        10,
        ~w(anime gaming art creative introvert),
        [],
        62,
        2,
        60,
        5,
        "Estudio Bellas Artes. Si quedamos, acabarás de personaje en mi próximo manga."
      ),
      p(
        "fernando",
        "Fernando",
        "man",
        45,
        "relationship",
        [:women],
        {35, 48},
        31,
        100,
        ~w(family_oriented cooking has_kids hiking monogamous),
        [],
        64,
        2,
        900,
        55,
        "Separado, con una hija de doce años que me corrige la ortografía de los whatsapps. Me gusta cocinar para mucha gente y el monte en otoño. Busco algo tranquilo y de verdad."
      )
    ]
  end

  defp women do
    [
      p(
        "marta",
        "Marta",
        "woman",
        31,
        "relationship",
        [:men],
        {27, 40},
        5,
        25,
        ~w(yoga reading cats coffee meditation),
        ~w(smoker),
        32,
        2,
        180,
        22,
        "Enfermera de urgencias: si sobrevivo a un sábado noche en La Paz, sobrevivo a lo que sea. En mis días libres, yoga, novela negra y siesta sin despertador. Busco calma con chispa."
      ),
      p(
        "paula",
        "Paula",
        "woman",
        26,
        "go_with_the_flow",
        [:men],
        {24, 34},
        3,
        25,
        ~w(dancing party music extrovert tattoos),
        [],
        10,
        3,
        40,
        10,
        "Bailo claqué a ratos y trabajo en una tienda de discos el resto del tiempo. Tengo opinión sobre todos los vinilos de los ochenta y ninguna sobre el fútbol."
      ),
      p(
        "carmen",
        "Carmen",
        "woman",
        34,
        "relationship",
        [:men],
        {30, 42},
        12,
        50,
        ~w(travel languages foodie wants_kids family_oriented),
        ~w(childfree),
        34,
        3,
        300,
        48,
        "Azafata de vuelo: he desayunado en Tokio y cenado en Lima en la misma semana, pero mi sitio favorito sigue siendo el mercado de San Fernando un domingo. Quiero formar familia, sin prisas."
      ),
      p(
        "laura",
        "Laura",
        "woman",
        29,
        "casual",
        [:men, :women],
        {25, 38},
        7,
        25,
        ~w(fitness running party night_owl),
        [],
        9,
        2,
        25,
        13,
        "Entrenadora personal que se salta el gimnasio si hay churros. Buena energía y cero dramas."
      ),
      p(
        "sara",
        "Sara",
        "woman",
        27,
        ~w(relationship meet_people),
        [:men, :women, :nb],
        {22, 35},
        15,
        50,
        ~w(board_games anime gaming introvert cats),
        [],
        36,
        2,
        90,
        3,
        "Recién mudada a Madrid y sin nadie con quien jugar al Dixit. Me gustan el anime de los noventa, los gatos que no se dejan tocar y los bares con juegos de mesa."
      ),
      p(
        "irene",
        "Irene",
        "woman",
        36,
        "relationship",
        [:women],
        {30, 44},
        8,
        25,
        ~w(art photography feminist coffee creative),
        [],
        43,
        3,
        720,
        66,
        "Ilustradora. Llevo siempre un cuaderno por si la vida me regala una buena cara en el metro. Me encanta perderme en el Rastro y volver con cosas que no necesito."
      ),
      p(
        "nerea",
        "Nerea",
        "woman",
        24,
        "go_with_the_flow",
        [:men],
        {22, 30},
        20,
        50,
        ~w(concerts music travel extrovert vegetarian),
        [],
        20,
        2,
        5,
        1,
        "Estudio Periodismo y soy fan número uno de los festivales de verano. Me muevo entre el Mad Cool y el sofá con la misma facilidad. Vegetariana y cabezota a partes iguales."
      ),
      p(
        "alba",
        "Alba",
        "woman",
        30,
        "relationship",
        [:men],
        {26, 38},
        24,
        50,
        ~w(hiking nature dogs environmentalist adventure),
        ~w(no_pets smoker),
        41,
        3,
        480,
        29,
        "Veterinaria rural reconvertida en urbanita (a mi pesar). Mi perra Bimba y yo nos escapamos a la sierra siempre que podemos. Si vienes, trae bocadillo de tortilla."
      ),
      p(
        "claudia",
        "Claudia",
        "woman",
        28,
        "casual",
        [:men],
        {24, 36},
        2,
        10,
        ~w(art creative party cannabis night_owl),
        [],
        31,
        2,
        150,
        7,
        "Diseñadora de moda que siempre viste de negro; la ironía no se me escapa. Me gustan las fiestas en azoteas y las conversaciones raras a las cuatro de la mañana."
      ),
      p(
        "elena",
        "Elena",
        "woman",
        38,
        "relationship",
        [:men],
        {33, 46},
        17,
        50,
        ~w(reading cinema has_kids family_oriented monogamous cooking),
        ~w(cannabis),
        47,
        2,
        1300,
        80,
        "Madre de un peque de seis años que me gana a todo. Abogada, lectora voraz y cocinera de domingos. Busco a alguien con paciencia, sentido del humor y ganas de algo bonito."
      ),
      p(
        "andrea",
        "Andrea",
        "woman",
        25,
        "meet_people",
        [:women, :men],
        {21, 32},
        4,
        25,
        ~w(languages travel volunteer curious coffee),
        [],
        5,
        3,
        60,
        18,
        "Italiana de Bolonia con un Erasmus que se me fue de las manos (tres años ya). Busco gente para cañas, intercambio de idiomas y descubrir el Madrid que no sale en las guías."
      ),
      p(
        "noelia",
        "Noelia",
        "woman",
        33,
        "go_with_the_flow",
        [:men],
        {28, 40},
        6,
        25,
        ~w(cooking foodie chill coffee dogs),
        [],
        24,
        2,
        360,
        26,
        "Repostera. Mi superpoder es saber si un bizcocho está listo solo por el olor. Busco a alguien que no tenga miedo a ganar un par de kilos por amor al arte."
      ),
      p(
        "rocio",
        "Rocío",
        "woman",
        31,
        "casual",
        [:men],
        {26, 40},
        9,
        50,
        ~w(party dancing smoker extrovert music),
        [],
        30,
        2,
        100,
        15,
        "Sevillana en Madrid. Hablo por los codos y me río todavía más alto."
      ),
      p(
        "ainhoa",
        "Ainhoa",
        "woman",
        27,
        "relationship",
        [:men, :nb],
        {24, 34},
        11,
        50,
        ~w(yoga meditation vegan spirituality astrology),
        [],
        21,
        3,
        240,
        20,
        "Profe de yoga y lectora de tarot en mis ratos libres (sí, te haré la carta astral). Vegana y muy fan de los mercadillos de segunda mano."
      ),
      p(
        "julia",
        "Julia",
        "woman",
        35,
        "meet_people",
        [:men, :women],
        {28, 45},
        21,
        50,
        ~w(running cycling fitness ambitious),
        ~w(smoker),
        26,
        2,
        30,
        35,
        "Dirijo proyectos: mi cabeza es un Excel, pero con colores bonitos. Preparo mi tercer maratón y busco gente con quien entrenar y después desayunar a lo grande."
      ),
      p(
        "patricia",
        "Patricia",
        "woman",
        42,
        "relationship",
        [:men],
        {36, 50},
        28,
        50,
        ~w(travel cooking has_kids reading monogamous),
        ~w(open_relationship),
        27,
        2,
        2200,
        95,
        "Dos hijos, un huerto urbano y una colección de guías de viaje subrayadas. Sé hacer paella para veinte y escuchar como nadie. Me apetece enamorarme otra vez, con calma."
      ),
      p(
        "cristina",
        "Cristina",
        "woman",
        29,
        "go_with_the_flow",
        [:men],
        {26, 38},
        5,
        25,
        ~w(cinema photography curious coffee cats),
        [],
        38,
        3,
        55,
        12,
        "Fotógrafa de bodas: he visto llorar a más gente en un día que en todo Titanic. Cínica en el amor, romántica en secreto. Mi gato se llama Truffaut y no pienso disculparme."
      ),
      p(
        "ines",
        "Inés",
        "woman",
        26,
        "relationship",
        [:women],
        {23, 33},
        3,
        25,
        ~w(music concerts reading feminist introvert),
        [],
        16,
        2,
        20,
        4,
        "Toco el bajo en una banda indie que no conoce ni mi madre. Leo poesía en el metro y escribo canciones en el móvil. Busco a alguien que me acompañe a los conciertos pequeños."
      ),
      p(
        "blanca",
        "Blanca",
        "woman",
        32,
        "go_with_the_flow",
        [:men, :women],
        {27, 40},
        10,
        50,
        ~w(travel adventure languages extrovert tattoos),
        [],
        49,
        3,
        75,
        31,
        "He vivido en cinco países y en todos aprendí a pedir croquetas. Nómada digital en pausa. Me apunto a cualquier escapada que empiece con «oye, ¿y si...?»."
      ),
      p(
        "aitana",
        "Aitana",
        "woman",
        23,
        "casual",
        [:men],
        {21, 30},
        14,
        50,
        ~w(party music fitness extrovert),
        [],
        19,
        2,
        35,
        9,
        "Fiestera los viernes, persona funcional los lunes. Reguetón antiguo y perritos calientes de madrugada."
      ),
      p(
        "yaiza",
        "Yaiza",
        "woman",
        30,
        "meet_people",
        [:women],
        {24, 38},
        23,
        50,
        ~w(nature hiking environmentalist volunteer vegan),
        [],
        29,
        2,
        1000,
        44,
        "Canaria perdida en la meseta. Busco gente para salir al campo, hacer voluntariados y quejarnos juntas de que aquí no hay playa. Planto tomates en el balcón con éxito variable."
      ),
      p(
        "candela",
        "Candela",
        "woman",
        28,
        "go_with_the_flow",
        [:men],
        {25, 35},
        7,
        25,
        ~w(art dancing creative chill astrology),
        [],
        28,
        2,
        10,
        2,
        "Ceramista. Hago tazas deformes con muchísimo cariño. Soy Piscis, lo que explica casi todo."
      ),
      p(
        "lola",
        "Lola",
        "woman",
        37,
        "meet_people",
        [:men, :women],
        {28, 46},
        2,
        10,
        ~w(foodie cooking coffee family_oriented dogs),
        [],
        23,
        3,
        45,
        52,
        "Tengo un bar de desayunos en Chamberí, así que sé cómo te gustan las tostadas antes de que lo digas. Busco gente con ganas de charlar, pasear al perro y comer bien."
      )
    ]
  end

  defp non_binary do
    [
      p(
        "alex",
        "Alex",
        "non_binary",
        30,
        "relationship",
        [:women, :nb, :men],
        {25, 36},
        7,
        50,
        ~w(hiking cooking reading curious board_games),
        [],
        48,
        2,
        15,
        24,
        "Trabajo en una biblioteca pública y organizo talleres de fanzines. Elle/él. Me flipan las rutas por la sierra con parada larga para comer. Hablo mucho de libros; quedas avisade."
      ),
      p(
        "noa",
        "Noa",
        "non_binary",
        27,
        "relationship",
        [:women, :nb],
        {23, 34},
        4,
        25,
        ~w(music art creative coffee vegetarian),
        [],
        25,
        2,
        180,
        10,
        "Ilustradore y DJ de cumpleaños (acepto peticiones, no garantizo ponerlas). Elle. Me encantan el café de especialidad y los bares con sofás que no hacen juego."
      ),
      p(
        "kai",
        "Kai",
        "non_binary",
        31,
        "go_with_the_flow",
        [:women, :men, :nb],
        {25, 38},
        9,
        50,
        ~w(travel photography adventure languages),
        [],
        35,
        3,
        400,
        28,
        "Medio japonés, medio de Getafe. Fotógrafe de viajes con alergia a los madrugones. Elle."
      ),
      p(
        "sam",
        "Sam",
        "non_binary",
        29,
        "go_with_the_flow",
        [:women, :nb],
        {24, 36},
        5,
        25,
        ~w(gaming anime board_games night_owl extrovert),
        [],
        22,
        2,
        30,
        2,
        "Sí, llevo bigote falso en la foto: me tomo muy en serio el humor. Programo videojuegos y me pico con cualquier juego de mesa. Elle, por favor."
      ),
      p(
        "eli",
        "Eli",
        "non_binary",
        35,
        "meet_people",
        [:men, :women, :nb],
        {26, 45},
        15,
        50,
        ~w(meditation yoga spirituality chill cats),
        [],
        39,
        2,
        700,
        40,
        "Esta foto es de mi día de spa anual; el resto del año soy más de manta y té. Terapeuta, elle, y fan de las conversaciones profundas a media tarde."
      ),
      p(
        "cris",
        "Cris",
        "non_binary",
        32,
        "casual",
        [:men, :nb],
        {25, 40},
        3,
        25,
        ~w(music concerts night_owl smoker tattoos),
        [],
        61,
        2,
        60,
        12,
        "Tatúo en Malasaña. Antes de dibujarte nada, una caña a ver si nos caemos bien."
      )
    ]
  end

  defp p(
         key,
         name,
         gender,
         age,
         intent,
         show,
         ages,
         km,
         distance,
         tags,
         blocked,
         portrait,
         extra,
         active,
         completed,
         bio
       ) do
    %{
      key: key,
      email: "#{key}@demo.cherry.dev",
      name: name,
      gender: gender,
      age: age,
      intent: intent,
      show: show,
      ages: ages,
      km: km,
      distance: distance,
      mode: if(rem(portrait, 3) == 0, do: :swipe, else: :feed),
      tags: tags,
      blocked: blocked,
      portrait: portrait,
      extra: extra,
      active: active,
      completed: completed,
      bio: bio
    }
  end

  # ── Scenario for demo@cherry.dev (Lucía) ────────────────────────────────

  # {persona, minutes ago}: they liked Lucía and she has not answered yet.
  @received_likes [
    {"sergio", 120},
    {"noa", 180},
    {"ruben", 300},
    {"jorge", 360},
    {"nacho", 1_440},
    {"marcos", 1_560},
    {"samuel", 2_880},
    {"adrian", 5_760}
  ]

  # {persona, minutes ago}: matches without messages yet.
  @quiet_matches [{"alvaro", 360}, {"iker", 1_440}]

  # {persona, minutes ago matched, [{from, minutes after match, body}], messages Lucía has read}
  @conversations [
    {"pablo", 4_320,
     [
       {:them, 40,
        "¡Hola, Lucía! Tengo que preguntarlo: ¿Tofu es un perro enorme o un perro pequeño con nombre de talla XL? 🐶"},
       {:me, 70,
        "Jajaja, enorme: 30 kilos que se creen caniche. Lo sé por el pelo que deja en mi sofá."},
       {:them, 85, "Mi gata se llama Croqueta, así que creo que nos vamos a entender."},
       {:me, 90, "Croqueta y Tofu. Esto ya parece la carta de un bar de tapas."},
       {:them, 1_440,
        "Hablando de tapas... ¿te apetece que el sábado probemos las bravas de un sitio de Lavapiés? Dicen que son las mejores de Madrid y necesito una segunda opinión experta."},
       {:me, 1_500,
        "Acepto el reto. Aviso de que soy muy exigente: llevo años perfeccionando las mías."},
       {:them, 1_515,
        "Perfecto. Si no están a la altura, me invitas a las tuyas 😄 ¿Te viene bien a la una y media?"}
     ], 7},
    {"alex", 2_880,
     [
       {:them, 60,
        "Hola, Lucía 👋 Me ha encantado lo de subir a la sierra los domingos. ¿Tienes alguna ruta favorita?"},
       {:me, 120,
        "¡Hola! La Pedriza siempre, aunque la última vez casi me tiene que bajar Tofu en brazos. ¿Y tú?"},
       {:them, 1_500,
        "Si te va la caña, la Cuerda Larga. Si prefieres algo tranquilo, la Senda de los Pescadores en Cercedilla, que en otoño está preciosa."},
       {:them, 1_502,
        "Y lo de las croquetas de tu abuela me ha dejado con intriga. ¿Receta secreta o se puede compartir? 🤫"}
     ], 2},
    {"diego", 7_200,
     [
       {:them, 120, "Hola, Lucía. Pregunta seria: ¿Catán o Carcassonne?"},
       {:me, 150,
        "Pregunta trampa. Carcassonne para una tarde tranquila; Catán si quiero perder amigos."},
       {:them, 155,
        "Respuesta perfecta. Tengo una estantería entera de juegos y nadie con quien estrenar la mitad."},
       {:me, 180, "Eso suena a petición de auxilio 😂 ¿Cuál tienes más ganas de estrenar?"},
       {:them, 190,
        "Uno de construir rutas de tren por Europa. Tiene tantas piezas que da miedo abrir la caja."},
       {:me, 1_440, "¡Me encanta ese! Te aviso de que soy muy competitiva con las rutas largas."},
       {:them, 1_460,
        "Pues ya tenemos plan. ¿Y en conciertos qué tal? He visto que tienes la etiqueta."},
       {:me, 1_500,
        "Me encanta la música en directo. Lo último fue una banda de folk asturiano en La Riviera y todavía no me he recuperado."},
       {:them, 1_505, "¡Yo trabajé en ese concierto! Llevaba el sonido. Qué pequeño es Madrid."},
       {:me, 1_507,
        "¿En serio? Entonces la culpa de que tuviera la canción en la cabeza una semana es tuya."},
       {:them, 2_880,
        "Culpable 🙋‍♂️ Para compensarlo: el viernes toca un grupo pequeñito en el Café Berlín. ¿Te vienes y luego echamos una partida?"},
       {:them, 5_760, "Por cierto, ya tengo las entradas por si te animas. Sin presión, ¿eh? 😊"}
     ], 11}
  ]

  # Lucía's own swipes on profiles that did not like her (minutes ago).
  @lucia_likes [{"javi", 200}, {"gonzalo", 1_000}, {"kai", 3_000}]
  @lucia_passes [{"oscar", 100}, {"raul", 900}, {"tomas", 2_000}, {"unai", 4_000}]

  # ── Run ────────────────────────────────────────────────────────────────

  def run do
    Application.put_env(:cherry, :expo_push_client, Cherry.DemoSeeds.SilentPush)

    now = DateTime.utc_now() |> DateTime.truncate(:second)
    tag_ids = Map.new(Repo.all(from t in Tag, where: t.is_active, select: {t.slug, t.id}))
    columns = profile_columns()

    all = main_personas() ++ personas()
    validate!(all, tag_ids)

    profiles =
      Map.new(all, fn persona -> {persona.key, upsert_persona(persona, tag_ids, columns, now)} end)

    reset_interactions(Enum.map(Map.values(profiles), & &1.id))
    build_lucia_scenario(profiles, now)
    refresh_tag_weights()

    summary(profiles)
  end

  defp validate!(personas, tag_ids) do
    keys = Enum.map(personas, & &1.key)
    portraits = Enum.map(personas, & &1.portrait)

    if length(Enum.uniq(keys)) != length(keys), do: raise("duplicated persona keys")
    if length(Enum.uniq(portraits)) != length(portraits), do: raise("duplicated portraits")

    Enum.each(personas, fn persona ->
      unknown = Enum.reject(persona.tags ++ persona.blocked, &Map.has_key?(tag_ids, &1))
      if unknown != [], do: raise("#{persona.key}: unknown tags #{inspect(unknown)}")

      if length(persona.tags) not in 3..8 or length(persona.blocked) > 5 or
           Enum.any?(persona.blocked, &(&1 in persona.tags)),
         do: raise("#{persona.key}: invalid tag selection")

      bio_length = String.length(persona.bio)
      if bio_length not in 20..240, do: raise("#{persona.key}: bio has #{bio_length} characters")
    end)
  end

  defp upsert_persona(persona, tag_ids, columns, now) do
    user = ensure_user(persona)

    profile =
      (Repo.get_by(Profile, user_id: user.id) || %Profile{})
      |> Profile.changeset(%{
        user_id: user.id,
        display_name: persona.name,
        birth_date: birth_date(persona),
        gender: persona.gender,
        # «¿Qué buscas?» admite varias: `intent` es una cadena o una lista.
        looking_for: List.wrap(persona.intent),
        bio: persona.bio,
        is_complete: true,
        is_paused: false,
        is_discoverable: true,
        deleted_at: nil
      })
      |> Repo.insert_or_update!()

    {age_min, age_max} = persona.ages

    {:ok, _pref} =
      Dating.upsert_discovery_preference(profile.id, %{
        age_min: age_min,
        age_max: age_max,
        distance_km: persona.distance,
        show_men: :men in persona.show,
        show_women: :women in persona.show,
        show_non_binary: :nb in persona.show,
        compatible_only: false,
        discovery_mode: persona.mode
      })

    {latitude, longitude} = coordinates(persona)

    {:ok, _location} =
      Dating.upsert_location(%{
        "profile_id" => profile.id,
        "latitude" => latitude,
        "longitude" => longitude,
        "accuracy_meters" => 50,
        "recorded_at" => now
      })

    slugs_to_ids = fn slugs -> Enum.map(slugs, &Map.fetch!(tag_ids, &1)) end
    {:ok, _} = Dating.set_profile_blocked_tags(profile.id, [])
    {:ok, _} = Dating.set_profile_tags(profile.id, slugs_to_ids.(persona.tags))
    {:ok, _} = Dating.set_profile_blocked_tags(profile.id, slugs_to_ids.(persona.blocked))

    Repo.delete_all(from ph in ProfilePhoto, where: ph.profile_id == ^profile.id)

    persona
    |> photo_urls()
    |> Enum.with_index(1)
    |> Enum.each(fn {url, position} ->
      {:ok, _photo} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "demo/#{persona.key}/#{position}",
          url: url,
          position: position,
          is_active: true
        })
    end)

    set_activity(profile.id, persona, columns, now)
    profile
  end

  defp ensure_user(persona) do
    user =
      case Repo.get_by(User, email: persona.email) do
        %User{} = user ->
          user

        nil ->
          {:ok, user} = Accounts.create_user(%{email: persona.email, display_name: persona.name})
          user
      end

    user
    |> Ecto.Changeset.change(display_name: persona.name, deleted_at: nil)
    |> Repo.update!()
  end

  # Birthday a few months ago, so the age is exact today.
  defp birth_date(persona) do
    Date.utc_today()
    |> Date.shift(year: -persona.age)
    |> Date.add(-(20 + :erlang.phash2(persona.key, 300)))
  end

  # Fixed coordinates are relative to Madrid: shifted with the center.
  defp coordinates(%{coords: {latitude, longitude}}) do
    {center_lat, center_lng} = center()
    {madrid_lat, madrid_lng} = @madrid

    {Float.round(latitude - madrid_lat + center_lat, 5),
     Float.round(longitude - madrid_lng + center_lng, 5)}
  end

  defp coordinates(persona) do
    {lat0, lng0} = center()
    bearing = :erlang.phash2({persona.key, :bearing}, 360) * :math.pi() / 180
    latitude = lat0 + persona.km / 111.32 * :math.cos(bearing)

    longitude =
      lng0 + persona.km / (111.32 * :math.cos(lat0 * :math.pi() / 180)) * :math.sin(bearing)

    {Float.round(latitude, 5), Float.round(longitude, 5)}
  end

  def photo_urls(persona) do
    ["https://i.pravatar.cc/800?img=#{persona.portrait}"] ++
      for n <- 2..(persona.extra + 1)//1,
          do: "https://picsum.photos/seed/cherry-#{persona.key}-#{n}/800/1000"
  end

  # completed_at / last_active_at are optional (discovery ranking v2 migration).
  defp set_activity(profile_id, persona, columns, now) do
    updates =
      [
        {"completed_at", DateTime.add(now, -persona.completed, :day)},
        {"last_active_at", DateTime.add(now, -persona.active, :minute)}
      ]
      |> Enum.filter(fn {column, _value} -> MapSet.member?(columns, column) end)
      |> Enum.map(fn {column, value} -> {String.to_atom(column), DateTime.to_naive(value)} end)

    if updates != [] do
      from(p in "profiles", where: p.id == type(^profile_id, :binary_id))
      |> Repo.update_all(set: updates)
    end
  end

  defp profile_columns do
    %{rows: rows} =
      Repo.query!(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles'"
      )

    MapSet.new(rows, fn [column] -> column end)
  end

  defp reset_interactions(profile_ids) do
    # Conversations, messages and read markers cascade from matches.
    Repo.delete_all(
      from m in Match, where: m.profile_a_id in ^profile_ids or m.profile_b_id in ^profile_ids
    )

    Repo.delete_all(
      from s in SwipeAction,
        where: s.actor_profile_id in ^profile_ids or s.target_profile_id in ^profile_ids
    )

    Repo.delete_all(
      from b in UserBlock,
        where: b.actor_profile_id in ^profile_ids or b.target_profile_id in ^profile_ids
    )

    Repo.delete_all(
      from r in Report,
        where: r.reporter_profile_id in ^profile_ids or r.target_profile_id in ^profile_ids
    )
  end

  defp build_lucia_scenario(profiles, now) do
    lucia = Map.fetch!(profiles, "lucia")
    ago = fn minutes -> DateTime.add(now, -minutes, :minute) end

    for {key, minutes} <- @received_likes do
      like!(Map.fetch!(profiles, key), lucia, ago.(minutes))
    end

    for {key, minutes} <- @quiet_matches do
      other = Map.fetch!(profiles, key)
      match_at!(other, lucia, ago.(minutes))
    end

    for {key, minutes, messages, read_count} <- @conversations do
      other = Map.fetch!(profiles, key)
      matched_at = ago.(minutes)
      match = match_at!(other, lucia, matched_at)
      conversation = Repo.preload(match, :conversation).conversation

      sent =
        Enum.map(messages, fn {from, offset, body} ->
          sender = if from == :me, do: lucia, else: other
          at = DateTime.add(matched_at, offset, :minute)

          {:ok, message} =
            Dating.send_message(%{
              conversation_id: conversation.id,
              sender_profile_id: sender.id,
              body: body
            })

          set_timestamps(Message, message.id, at)
          {from, at}
        end)

      {_from, first_at} = hd(sent)
      {_from, last_at} = List.last(sent)
      {_from, lucia_read_at} = Enum.at(sent, read_count - 1)

      from(m in Match, where: m.id == ^match.id)
      |> Repo.update_all(set: [first_message_at: first_at, expires_at: nil])

      from(c in Cherry.Dating.Conversation, where: c.id == ^conversation.id)
      |> Repo.update_all(set: [inserted_at: matched_at, updated_at: last_at])

      mark_read(conversation.id, lucia.id, lucia_read_at)
      mark_read(conversation.id, other.id, last_at)
    end

    for {key, minutes} <- @lucia_likes, do: like!(lucia, Map.fetch!(profiles, key), ago.(minutes))

    for {key, minutes} <- @lucia_passes do
      {:ok, %{swipe: swipe}} =
        Dating.record_swipe(%{
          actor_profile_id: lucia.id,
          target_profile_id: Map.fetch!(profiles, key).id,
          action_type: "dislike"
        })

      set_timestamps(SwipeAction, swipe.id, ago.(minutes))
    end
  end

  defp like!(actor, target, at) do
    {:ok, %{swipe: swipe, match: match}} =
      Dating.record_swipe(%{
        actor_profile_id: actor.id,
        target_profile_id: target.id,
        action_type: "like"
      })

    set_timestamps(SwipeAction, swipe.id, at)
    match
  end

  # They liked Lucía shortly before she liked them back at `matched_at`.
  defp match_at!(other, lucia, matched_at) do
    nil = like!(other, lucia, DateTime.add(matched_at, -97, :minute))
    %Match{} = match = like!(lucia, other, matched_at)

    from(m in Match, where: m.id == ^match.id)
    |> Repo.update_all(
      set: [
        matched_at: matched_at,
        expires_at: match_expires_at(matched_at),
        inserted_at: matched_at,
        updated_at: matched_at
      ]
    )

    match
  end

  defp match_expires_at(matched_at) do
    if Code.ensure_loaded?(Cherry.Dating.MatchExpiry) and
         function_exported?(Cherry.Dating.MatchExpiry, :expires_at, 1),
       do: Cherry.Dating.MatchExpiry.expires_at(matched_at),
       else: DateTime.add(matched_at, Application.get_env(:cherry, :match_expiry_days, 30), :day)
  end

  defp set_timestamps(SwipeAction, id, at) do
    from(s in SwipeAction, where: s.id == ^id) |> Repo.update_all(set: [inserted_at: at])
  end

  defp set_timestamps(Message, id, at) do
    at = %{at | microsecond: {elem(at.microsecond, 0), 6}}

    from(r in Message, where: r.id == ^id)
    |> Repo.update_all(set: [inserted_at: at, updated_at: at])
  end

  defp set_timestamps(schema, id, at) do
    from(r in schema, where: r.id == ^id)
    |> Repo.update_all(set: [inserted_at: at, updated_at: at])
  end

  # conversation_reads is optional (added by the read-state migration).
  defp mark_read(conversation_id, profile_id, at) do
    cond do
      Code.ensure_loaded?(Cherry.Dating.Inbox) and
          function_exported?(Cherry.Dating.Inbox, :mark_read, 3) ->
        Cherry.Dating.Inbox.mark_read(conversation_id, profile_id, at)

      conversation_reads_table?() ->
        Repo.query!(
          """
          INSERT INTO conversation_reads (id, conversation_id, profile_id, last_read_at, inserted_at, updated_at)
          VALUES ($1, $2, $3, $4, $4, $4)
          ON CONFLICT (conversation_id, profile_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
          """,
          [
            Ecto.UUID.dump!(Ecto.UUID.generate()),
            Ecto.UUID.dump!(conversation_id),
            Ecto.UUID.dump!(profile_id),
            DateTime.to_naive(at)
          ]
        )

      true ->
        :skip
    end
  end

  defp conversation_reads_table? do
    %{rows: [[exists]]} =
      Repo.query!("SELECT to_regclass('public.conversation_reads') IS NOT NULL")

    exists
  end

  defp refresh_tag_weights do
    module = Cherry.Dating.Discovery.TagWeights

    if Code.ensure_loaded?(module) and function_exported?(module, :refresh, 1) do
      module.refresh(DateTime.utc_now())
    end
  end

  defp summary(profiles) do
    counts =
      profiles
      |> Map.values()
      |> Enum.frequencies_by(fn profile -> profile.gender end)

    IO.puts("""

    Demo lista: #{map_size(profiles)} perfiles completos #{inspect(counts)}.
      demo@cherry.dev  → Lucía (8 likes recibidos, 5 matches, 3 conversaciones)
      demo2@cherry.dev → Hugo (sin interacciones)
    Entrar: POST /api/auth/dev/test-login {"email": "demo@cherry.dev"}
    """)
  end
end

Cherry.DemoSeeds.run()
