defmodule Cherry.Legal.Documents do
  @moduledoc "Versioned Spanish-instance texts. Unknown facts stay explicit; approval is not inferred."
  alias Cherry.Legal.Identity

  def version, do: "2026-10-17.2"

  def all do
    [privacy(), terms(), rules(), children(), transparency(), notice(), cookies()]
  end

  defp privacy do
    document(
      "privacidad",
      "Política de privacidad",
      "Tus datos sirven para relacionarte, no para vender tu atención.",
      [
        {"Responsable y ámbito",
         "El responsable de esta instancia es #{Identity.value(:name)}, con domicilio en #{Identity.value(:address)} y correo #{Identity.value(:email)}. Cherry se dirige a personas de 18 años o más en España. Otros operadores de Cherry responden de sus propias instancias. La futura cooperativa Akorda no es hoy el responsable: cualquier cambio se informará antes de hacerse efectivo, con identidad, contacto, fecha y efectos sobre tus datos."},
        {"Cuenta e identidad de acceso",
         "Recibimos del proveedor de acceso Google o Apple el identificador de usuario, correo y, cuando se facilita, nombre. No recibimos su contraseña ni acceso general a sus servicios. Para Apple conservamos cifrada una credencial limitada a revocar su autorización al borrar la cuenta; si Apple no responde, solo esa instrucción cifrada queda pendiente de reintento y se elimina tras la confirmación. Utilizamos estos datos y las sesiones para crear y proteger tu cuenta y prestar el servicio solicitado (art. 6.1.b RGPD). Los proveedores también aplican sus propias políticas a su servicio de identidad."},
        {"Perfil y preferencias sensibles",
         "Tratamos el nombre visible, fecha de nacimiento, género, intención de relación, biografía, etiquetas, fotografías y preferencias que facilitas para mostrar tu perfil y seleccionar perfiles compatibles. Algunas elecciones pueden revelar vida u orientación sexual u otras categorías especiales. La propuesta jurídica es art. 6.1.a y consentimiento explícito del art. 9.2.a RGPD para esa finalidad específica, separado de las condiciones. Está pendiente validar su suficiencia en España, incluido el art. 9.1 LOPDGDD; publicar este texto no resuelve esa evaluación. No añadas datos sensibles de terceros ni categorías innecesarias en texto libre."},
        {"Quién ve tu perfil",
         "Los perfiles y fotos se muestran a otras personas autenticadas según visibilidad, filtros, bloqueos y matches, no en un directorio web abierto. La ubicación se redondea a una rejilla de aproximadamente 500 metros; usamos ese punto para proximidad y mostramos distancias aproximadas. Una distancia, foto o biografía puede permitir inferencias sobre tu ubicación o identidad. No prometemos anonimato ni impedir capturas o copias hechas por destinatarios."},
        {"Ubicación y permisos",
         "Solicitamos ubicación del dispositivo en primer plano para actualizar la proximidad; no ofrecemos seguimiento continuo en segundo plano. El móvil redondea las coordenadas antes de enviarlas. Puedes revocar permisos en el sistema. Cámara/galería se usan si eliges aportar fotos y NFC si eliges verificar un documento compatible. El permiso del sistema no sustituye el consentimiento RGPD. No accedemos a tu agenda de contactos."},
        {"Likes, matches y mensajes",
         "Tratamos decisiones de like/dislike, bloqueos, matches, lecturas y mensajes para las funciones que solicitas (art. 6.1.b), con la condición del art. 9 que corresponda cuando revelen categorías especiales. Los mensajes se cifran en la base de datos, no de extremo a extremo: el servidor puede descifrarlos. El backoffice ordinario no permite consultar chats. No uses el chat como archivo ni para enviar documentos, datos bancarios o información de menores."},
        {"Verificación de edad",
         "La comprobación NFC procesa datos firmados del documento para verificar edad y autenticidad técnica, pero no prueba por sí sola que quien usa el móvil sea su titular. Conservamos resultado, fechas, país/tipo de documento y una huella HMAC con clave para evitar cuentas simultáneas con el mismo documento; no conservamos su número ni copia en la BD. Esa huella sigue siendo un dato personal. La finalidad de seguridad y mayoría de edad requiere ponderación del art. 6.1.f y evaluación específica, no una obligación legal inventada. Didit está desactivado en producción: no se enviarán datos a un proveedor externo sin informar antes de su identidad, función, conservación y garantías, y validar cualquier tratamiento biométrico."},
        {"Atención y seguridad",
         "Tratamos el contenido mínimo de reportes, solicitudes, decisiones motivadas y recursos para atenderte y proteger a la comunidad (art. 6.1.b o interés legítimo ponderado del art. 6.1.f según la finalidad). Los derechos RGPD se atienden por obligación legal, art. 6.1.c. No envíes copias de material ilegal ni información de terceros innecesaria. Las categorías especiales y datos sobre infracciones penales necesitan además su habilitación específica; un interés legítimo genérico no la sustituye."},
        {"Personas y proveedores con acceso",
         "El titular y las personas autorizadas de apoyo acceden solo según su función, confidencialidad y necesidad. El backend y PostgreSQL se alojan en infraestructura propia en España. Cloudflare R2 almacena fotos privadas, copias cifradas y el registro técnico de bajas en buckets de jurisdicción UE; la región no excluye por sí sola todo acceso internacional. Google/Apple intervienen cuando eliges su acceso; Expo puede intervenir en notificaciones push si registras un dispositivo; las tiendas y sistemas operativos tienen tratamientos propios. Las alertas técnicas pueden llegar al Telegram del operador sin incluir intencionadamente mensajes ni perfiles. Contratos, roles y garantías internacionales de cada servicio están pendientes de validación antes de apertura; no se declara que todos sean encargados ni que todo dato permanezca siempre en España."},
        {"Notificaciones y datos técnicos",
         "Si habilitas notificaciones, tratamos token de dispositivo, plataforma y eventos necesarios para avisos. Puedes desactivarlas en el sistema. Se generan registros técnicos de solicitudes y seguridad; no usamos publicidad ni analítica comercial, pero esto no equivale a ausencia total de logs. El contenido exacto y la retención de proxy, BD y recolectores deben verificarse antes de apertura. No vendemos datos, no insertamos anuncios y no entrenamos modelos de IA con perfiles o conversaciones."},
        {"Durante cuánto tiempo",
         "Los datos de cuenta, perfil y actividad se conservan mientras la cuenta exista o hasta que elimines el dato mediante las funciones disponibles. No hay borrado automático por mera inactividad. Los expedientes y su auditoría siguen vinculados a las cuentas y se incluyen en su borrado; no existe todavía una purga por antigüedad independiente. Este criterio está pendiente de revisión de necesidad y de los plazos legales. No mantenemos una lista permanente de DNI de personas suspendidas tras su baja."},
        {"Borrar o retirar el consentimiento",
         "En Ajustes puedes borrar la cuenta, también suspendida. La propuesta de retirada del consentimiento sensible es retirar y borrar: se informa antes de confirmar porque no podemos continuar el servicio de citas sin ese tratamiento. También puedes solicitarlo por correo sin sesión; la solicitud no exige aceptar condiciones nuevas. Se eliminan físicamente cuenta, correo, OAuth, huella documental, perfil, preferencias, actividad, conversaciones compartidas y expedientes vinculados. Las conversaciones desaparecen también para la otra persona. Un nuevo registro empieza desde cero, incluso con el mismo DNI. La retirada no altera la licitud del tratamiento anterior."},
        {"Medidas sobre otras personas",
         "Al borrar quien reportó no se levanta automáticamente una suspensión ajena. Solo puede quedar una ficha mínima de la medida y su revisión, sin identidad, relato ni enlaces a quien reportó. Desaparece al borrar a la persona afectada. No es una lista negra externa ni una conservación del expediente original."},
        {"Fotos, copias y registro de bajas",
         "La baja solicita eliminación de objetos; una cola mínima reintenta fallos. Las lecturas privadas de fotos utilizan firmas de 300 segundos: quien tenga una firma puede usarla hasta que caduque. No podemos revocar descargas anteriores. Hay una copia completa diaria de BD, cifrada, conservada siete días, sin copias de fotos. La limpieza explícita se programa cada 15 minutos y depende de disponibilidad; el lifecycle de R2 puede añadir demora, normalmente hasta 24 horas. No se promete destrucción al segundo. Un registro técnico externo de UUID/referencias de bajas impide reapariciones al restaurar; no contiene correo, DNI ni relatos, pero no es anónimo. Su limpieza requiere acuse, al menos siete días, ausencia de copias inseguras y comprobación de la BD viva, no un TTL ciego."},
        {"Conservación impuesta por ley",
         "Pueden existir obligaciones de bloqueo o conservación limitada para responsabilidades, órdenes válidas o reclamaciones (incluido art. 32 LOPDGDD). No justifican reutilizar datos bloqueados para el servicio, publicidad o impedir un registro nuevo. El sistema actual no incorpora una reserva legal segregada: su alcance y adaptación están pendientes de revisión antes de apertura. No prometemos que borrar todo sin excepción sea jurídicamente correcto ni conservamos silenciosamente un archivo adicional."},
        {"Tus derechos y cómo ejercerlos",
         "Puedes pedir acceso, copia, rectificación, supresión, limitación, oposición y portabilidad cuando proceda, o retirar tu consentimiento. Usa Buzón y privacidad o #{Identity.value(:email)}, también sin cuenta o tras desinstalar. Describe la solicitud y un modo de respuesta, sin adjuntar DNI por defecto. Si hay dudas razonables pediremos información proporcionada para verificar identidad o representación. El ejercicio es gratuito salvo las excepciones legales; no basta que una solicitud resulte incómoda para denegarla. Responderemos en un mes; solo podrá prorrogarse hasta dos meses adicionales por complejidad o número de solicitudes, informando y motivando dentro del primer mes. Una denegación indicará motivos y vías de reclamación. Puedes reclamar ante la AEPD, https://www.aepd.es."},
        {"Automatización y cambios",
         "La selección de perfiles utiliza preferencias, etiquetas, proximidad y señales de actividad; puede constituir elaboración de perfiles, pero no cobra por prioridad. No hay sanciones automáticas por acumular reportes ni IA resolviendo recursos. No afirmamos que cualquier automatización futura quede fuera del art. 22 RGPD. Cambios sustanciales se informarán y, si requieren consentimiento nuevo, se solicitará antes de aplicarlos; no se obtendrá por silencio."}
      ]
    )
  end

  defp terms do
    document(
      "condiciones",
      "Condiciones de uso",
      "Una comunidad de citas gratuita para personas adultas en España.",
      [
        {"Quién presta el servicio",
         "El servicio lo presta #{Identity.value(:name)}, NIF #{Identity.value(:tax_id)}, domicilio #{Identity.value(:address)}, contacto #{Identity.value(:email)}. La cooperativa Akorda es un proyecto futuro, no la parte contratante actual. Estas condiciones se aplican a esta instancia, no automáticamente a otros operadores del código."},
        {"Edad y cuenta personal",
         "Debes tener al menos 18 años, usar una cuenta propia y aportar información veraz. No uses documentos prestados, suplantes a otras personas ni permitas a menores utilizar tu cuenta. La verificación técnica no garantiza identidad, conducta, antecedentes ni seguridad de una cita. Cuida el acceso de Google/Apple y avisa de accesos indebidos."},
        {"Servicio gratuito",
         "No hay cuotas, suscripciones, anuncios, compras internas ni venta de datos. No garantizamos obtener matches, parejas o resultados concretos, ni disponibilidad ininterrumpida. Podemos realizar mantenimiento proporcionado e informar de cambios relevantes; los derechos imperativos no se excluyen por ser un servicio gratuito."},
        {"Contenido y licencia limitada",
         "Conservas tus derechos sobre tus fotos y textos. Solo nos autorizas, de forma no exclusiva y sin pago, a almacenarlos, procesarlos técnicamente y mostrarlos a los destinatarios necesarios para prestar las funciones que eliges, mientras proceda su conservación. No es una cesión de propiedad, licencia publicitaria ni permiso para entrenar IA. Debes disponer de los derechos y autorizaciones necesarios y no publicar información privada de terceros."},
        {"Normas de convivencia",
         "Las normas de comunidad forman parte de estas condiciones. Se prohíben acoso, amenazas, discriminación, estafas, spam, suplantación, explotación, trata, pornografía, imágenes íntimas sin consentimiento y cualquier explotación o abuso sexual infantil. No uses robots ni extracción masiva de perfiles ni eludas controles de seguridad. Un match nunca equivale a consentimiento sexual."},
        {"Reportes y medidas",
         "Puedes bloquear y reportar desde la app o contactar sin iniciar sesión. Indica la cuenta o contenido, hechos y localización suficiente, sin redistribuir material ilegal. El equipo humano valora la información y puede advertir, suspender o retirar cuando exista una vía operativa para ese contenido, con motivos y proporcionalidad. No se sanciona automáticamente por el número de reportes. Una suspensión limita la actividad social, no tus derechos, buzón ni posibilidad de borrar la cuenta."},
        {"Revisión y reclamación",
         "Las decisiones se comunican en el buzón; puedes solicitar revisión por una persona distinta de la decisión original. No fijamos aquí un plazo corto que limite derechos o plazos legales aplicables. El panel exige cuentas distintas, pero la independencia depende de que sean personas reales. No hay soporte 24/7 ni respuesta inmediata garantizada. Si no puedes acceder, usa el correo público; no renuncias a acudir a autoridades, AEPD o tribunales competentes."},
        {"Pausa, retirada y baja",
         "Puedes pausar tu visibilidad, bloquear, deshacer un match y borrar la cuenta. La baja elimina también conversaciones compartidas y es irreversible desde la app; no equivale a una pausa. La retirada del consentimiento sensible y sus efectos se explican por separado en privacidad. Puedes registrarte desde cero con el mismo documento tras borrar; una suspensión no implica una prohibición documental perpetua."},
        {"Seguridad fuera de la app",
         "No envíes dinero ni documentos a desconocidos. Para primeras citas utiliza lugares públicos y avisa a alguien de confianza. Si existe peligro inmediato llama al 112: Cherry no es un servicio de emergencias ni sustituye a la policía. No garantizamos el comportamiento de otras personas, pero esto no elimina las responsabilidades propias del operador conforme a la ley."},
        {"Código, aplicación y tiendas",
         "El código se ofrece bajo AGPL-3.0-only; las marcas tienen sus reglas independientes. La licencia de software no convierte en públicos los datos personales y estas condiciones no restringen los derechos que otorga AGPL. Apple/Google no prestan este servicio de citas ni asumen soporte del operador; sus condiciones de plataforma pueden aplicarse a la descarga. Si una tienda exige cláusulas específicas de EULA se revisarán antes de distribuir, sin atribuirle derechos u obligaciones que no procedan."},
        {"Cambios y cierre",
         "Informaremos de cambios sustanciales y de la fecha de efecto antes de aplicarlos cuando corresponda. No se aceptan por silencio nuevas finalidades sensibles ni se transfiere hoy el servicio a una cooperativa no constituida. Si cesa el servicio, se informará de las opciones de ejercicio de derechos y del tratamiento de datos; no se venderán perfiles como parte del cierre."},
        {"Ley y derechos imperativos",
         "Se aplica la legislación española y europea pertinente, sin privarte de la protección y jurisdicción imperativas que correspondan. No imponemos arbitraje obligatorio, foro exclusivo ni renuncia de derechos. Si una cláusula resulta inválida se aplicará la normativa imperativa; no se utiliza esta cláusula para sustituirla unilateralmente por otra más gravosa."}
      ]
    )
  end

  defp rules do
    document(
      "normas",
      "Normas de comunidad",
      "Respeto, personas reales y consentimiento en cada paso.",
      [
        {"Adultos y personas reales",
         "Solo mayores de 18 años. No suplantes identidades, no uses fotos o documentos ajenos ni perfiles engañosos, bots, estafas o captación comercial. No publiques datos de contacto privados de otra persona."},
        {"Respeto y consentimiento",
         "No se permiten acoso, amenazas, discriminación, odio, persecución, presión sexual o difusión de información íntima. Respeta un no, un bloqueo y un unmatch. Un like o match no supone consentimiento para nada más."},
        {"Fotos y textos",
         "Aporta contenido propio o autorizado. Se prohíben pornografía, desnudos sexuales, imágenes íntimas sin consentimiento, explotación, trata y material o conductas de abuso sexual infantil. No subas fotos de menores. La moderación previa de fotos está pendiente de implantación y no se presenta como activa."},
        {"Cómo avisar",
         "Usa Bloquear o Reportar en el perfil/chat, o #{Identity.value(:email)} sin sesión. Indica la localización del contenido o identificador del perfil, motivo y hechos concretos. Para posibles contenidos ilícitos aporta una explicación suficiente y declara de buena fe que la información es exacta; no envíes material ilegal ni datos de terceros innecesarios. El correo no es un chat de emergencias."},
        {"Qué revisa el equipo",
         "Las decisiones actuales son humanas y deben basarse en hechos, gravedad y contexto, no en el número de denuncias. El panel ordinario muestra relato y texto actual del perfil, no capturas históricas, chats ni un visor general de fotos. No prometemos detectar todos los abusos. Una advertencia o suspensión debe indicar motivos y vía de recurso sin revelar la identidad de quien reporta."},
        {"Revisión y derechos",
         "Puedes consultar la respuesta y solicitar revisión en el buzón o por el correo público. La revisión corresponde a otra persona real; una segunda cuenta de quien decidió no cumple esa independencia. Mantienes privacidad, reclamaciones y baja durante una suspensión. No uses el sistema para acosar mediante reportes maliciosos."}
      ]
    )
  end

  defp children do
    document(
      "seguridad-infantil",
      "Seguridad infantil",
      "Cherry es para adultos y prohíbe toda explotación y abuso sexual infantil.",
      [
        {"Prohibición expresa",
         "Se prohíben material de abuso sexual infantil, captación sexual de menores, extorsión sexual, sexualización, trata y cualquier explotación o conducta que ponga en peligro a menores. No se permite la presencia de menores ni fotos de menores en perfiles."},
        {"Avisar sin difundir",
         "Reporta en la app con Posible menor cuando corresponda o escribe a #{Identity.value(:email)}. Facilita identificador/localización y explicación, no descargues, adjuntes, reenvíes ni generes material ilegal para probarlo. Ante peligro inmediato llama al 112 o contacta con autoridades competentes."},
        {"Responsable de recepción",
         "El contacto del titular #{Identity.value(:name)} recibe avisos para su evaluación y escalado; no se presenta como un DPD designado. La persona de contacto de seguridad infantil y su cobertura deben confirmarse para las tiendas antes de apertura. No existe atención de emergencia 24/7."},
        {"Actuación y límites actuales",
         "Los avisos de posible menor tienen prioridad en el panel. Corresponde valorar restricción, retirada, comunicación a autoridades y preservación legal estrictamente necesaria, evitando acceso y copias innecesarias. El procedimiento de fotos y respuesta operativa sigue pendiente: esta política no acredita moderación previa, cobertura humana ni comunicación efectiva a autoridades. Solo se ensaya con datos sintéticos benignos."}
      ]
    )
  end

  defp transparency do
    document(
      "transparencia",
      "Cómo funciona Cherry",
      "Código abierto y límites explicados sin promesas comerciales.",
      [
        {"Sin monetización",
         "No hay suscripciones, publicidad, venta de datos ni prioridad pagada. El titular mantiene esta instancia con infraestructura propia y apoyo voluntario cuando se organice. No se exige adoptar la escala ni organización de una gran plataforma."},
        {"Cómo ordenamos perfiles",
         "Los filtros consideran preferencias recíprocas, edad, género, intención, distancia y bloqueos en ambas direcciones. Entre los elegibles, el orden combina afinidad de etiquetas, intención, likes recibidos, novedad, actividad, distancia, exploración y reparto de atención. No se garantiza compatibilidad personal ni resultados. Puedes cambiar filtros, bloquear etiquetas o personas y pausar tu perfil."},
        {"Atención humana",
         "El backoffice separa moderación, privacidad y administración, con permisos revocables y auditoría. No hay IA decidiendo sanciones o recursos. Su disponibilidad técnica no equivale a que haya dos personas reales cubriendo decisiones y revisiones."},
        {"Código y otros operadores",
         "Puedes consultar el código correspondiente en el enlace de esta instancia. Se distribuye bajo AGPL-3.0-only. Otras instalaciones tienen responsables propios y no comparten automáticamente tu cuenta. No se autoriza reutilizar perfiles por ser software libre."},
        {"Qué no prometemos",
         "No ofrecemos cifrado de extremo a extremo, identidad infalible, ausencia de capturas, borrado instantáneo de toda copia, alta disponibilidad ni tiempo garantizado de recuperación. Moderación de fotos, OAuth completo para todas las versiones y validación de tiendas siguen pendientes. Esta web no anuncia la apertura pública."}
      ]
    )
  end

  defp notice do
    document("aviso-legal", "Aviso legal", "Identificación del titular de esta instancia.", [
      {"Titular actual",
       "#{Identity.value(:name)}. NIF: #{Identity.value(:tax_id)}. Domicilio: #{Identity.value(:address)}. Correo de atención, privacidad y comunicaciones: #{Identity.value(:email)}. Servicio gratuito de citas para adultos en España."},
      {"Registro y forma de operación",
       Identity.info().registry ||
         "[PENDIENTE: confirmar datos registrales si son exigibles o documentar por qué no proceden para el titular persona física]. No se atribuye una inscripción a una entidad que todavía no existe."},
      {"Futura cooperativa",
       "La intención de operar mediante Akorda cooperativa valenciana no implica que esté constituida ni que sea hoy titular o responsable del tratamiento. Si se formaliza el cambio, se identificarán razón social, NIF, domicilio, registro, contacto, fecha y garantías antes de hacerlo efectivo. No es una autorización anticipada para ceder datos a cualquier entidad."},
      {"Ámbito normativo",
       "Se aplica la normativa de protección de datos pertinente. La aplicabilidad concreta de LSSI y DSA depende de la naturaleza y operación real del servicio gratuito, no solo de su etiqueta open source. Se ofrece esta identificación sin afirmar que una exención de pequeña entidad excluya todas las obligaciones. No hay pagos ni contratación de servicios de terceros desde este aviso."},
      {"Propiedad y enlaces",
       "Las licencias del código y de sus dependencias se identifican en el repositorio. Fotos, textos y datos personales mantienen sus derechos y no son contenido libre por aparecer en Cherry. Los enlaces oficiales de información no implican que terceros avalen el servicio ni que el operador pueda excluir responsabilidades legales propias."}
    ])
  end

  defp cookies do
    document(
      "cookies",
      "Cookies y almacenamiento",
      "Sin cookies publicitarias ni rastreo comercial.",
      [
        {"Web pública",
         "Las páginas propias no incorporan analítica, píxeles publicitarios, fuentes remotas ni scripts de terceros. La pila web puede utilizar almacenamiento estrictamente técnico para seguridad de sesión/CSRF cuando resulte necesario. No instalamos un banner para simular consentimiento de cookies inexistentes; si se añaden usos no necesarios deberán informarse y obtener consentimiento antes de activarlos."},
        {"Backoffice",
         "El panel utiliza cookies propias de sesión y protección CSRF. La sesión administrativa tiene una duración máxima actual de ocho horas, acceso HTTPS y cookie de autenticación HttpOnly, Secure y SameSite Strict. Cerrar sesión revoca la credencial del servidor. No sirven para publicidad ni seguimiento entre sitios."},
        {"App y fotos",
         "La app guarda credenciales de sesión mediante almacenamiento seguro del sistema y estado necesario para funcionar. El código nuevo evita nuevas cachés de fotos privadas en disco y renueva firmas autorizadas, pero todavía debe distribuirse y comprobarse en móviles reales. No podemos borrar capturas ni garantizar la limpieza de cachés de versiones antiguas. Los proveedores OAuth y las tiendas aplican sus propias políticas fuera de nuestras páginas."},
        {"Control",
         "Puedes gestionar cookies en tu navegador y permisos/almacenamiento de la app en el sistema operativo. Bloquear almacenamiento técnico puede impedir iniciar sesión. Para más información o derechos usa #{Identity.value(:email)}."}
      ]
    )
  end

  defp document(slug, title, intro, sections),
    do: %{slug: slug, title: title, intro: intro, sections: sections}
end
