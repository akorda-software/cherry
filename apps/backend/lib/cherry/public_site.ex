defmodule Cherry.PublicSite do
  @moduledoc "Public, versioned drafts: no invented legal identity or promises of completed compliance."
  def version, do: "2026-10-17"

  def documents do
    [
      %{
        slug: "privacidad",
        title: "Privacidad",
        intro: "Tus datos sirven para que Cherry funcione. No son nuestro negocio.",
        sections: [
          {"Qué necesita la aplicación",
           "La cuenta utiliza tu identidad de acceso de Google o Apple. El perfil contiene los datos que facilitas, tus preferencias, fotos y una ubicación aproximada. Likes, matches y mensajes permiten relacionarte con otras personas. Las preferencias pueden revelar orientación sexual y requieren una condición jurídica válida y, si se utiliza consentimiento, que sea explícito y demostrable."},
          {"Verificación de edad",
           "Cuando se verifica un documento, Cherry conserva el resultado y una huella criptográfica con clave para evitar cuentas simultáneas con el mismo documento. No conserva el número ni la copia del documento en su base de datos. Si se ofrece un proveedor externo, su intervención y conservación deben estar identificadas antes de utilizarlo."},
          {"Qué significa cifrado",
           "El contenido de los mensajes se cifra en la base de datos. No es cifrado de extremo a extremo: el servidor puede descifrarlo para prestar el servicio. El panel de atención no ofrece acceso a conversaciones privadas."},
          {"Cuando borras tu cuenta",
           "Se eliminan de la base de datos la cuenta, correo, identidades de acceso, huella del documento, perfil, preferencias, actividad social, conversaciones y expedientes vinculados. Las conversaciones compartidas dejan de estar disponibles también para la otra persona. Puedes volver a registrarte desde cero y verificar el mismo DNI."},
          {"Medidas sobre otras cuentas",
           "Tu borrado no levanta automáticamente una suspensión de otra cuenta. Si hace falta para mantener su vía de revisión, se conserva una ficha mínima de esa medida y del estado de su recurso, sin tu identidad, relato ni datos personales. El expediente original y sus textos se eliminan. Si la otra cuenta se borra, también desaparece esa ficha."},
          {"Archivos y copias",
           "La eliminación de archivos se solicita al almacenamiento utilizado por esta instancia. Si falla, una cola temporal conserva solo las referencias necesarias para reintentarlo y las elimina al terminar. No equivale a garantizar que todas las cachés y backups desaparezcan en el mismo segundo. Sus plazos y cualquier conservación legal deben quedar concretados antes de abrir el servicio."},
          {"Tus derechos",
           "Puedes solicitar acceso, rectificación, supresión, limitación, oposición y portabilidad cuando corresponda. Usa el buzón de la app o el contacto público de esta instancia, también si no puedes iniciar sesión. La respuesta se facilita en el plazo legal aplicable; como regla general del RGPD, un mes. Puedes reclamar ante la Agencia Española de Protección de Datos."},
          {"Pendiente antes del lanzamiento",
           "Falta cerrar las bases jurídicas por finalidad, los consentimientos, los proveedores efectivos, las transferencias, los plazos de conservación y el tratamiento de backups y reservas legales. Este borrador no sustituye esa información."}
        ]
      },
      %{
        slug: "condiciones",
        title: "Condiciones de uso",
        intro: "Una comunidad para conocer gente, sin suscripciones ni anuncios.",
        sections: [
          {"Para personas adultas",
           "La instancia oficial está dirigida a mayores de 18 años en España. Debes cumplir los requisitos de edad, facilitar información veraz y no utilizar documentos de otras personas."},
          {"Tu cuenta y tus decisiones",
           "Puedes pausar el perfil, bloquear a otras personas, deshacer un match y borrar la cuenta. El borrado no tiene recuperación. Un nuevo registro empieza desde cero y necesita completar de nuevo el perfil y la verificación que esté habilitada."},
          {"Contenido y convivencia",
           "Comparte únicamente contenido propio o que tengas derecho a utilizar. No se permiten acoso, amenazas, suplantación, estafas, explotación, pornografía ni contenido sexual de menores. Las normas de comunidad explican cómo reportar y cómo actúa el equipo."},
          {"Atención y medidas",
           "El equipo revisa los reportes y puede advertir o suspender cuentas con motivos. Puedes consultar el expediente y la respuesta en el buzón. No hay un chat de soporte en directo ni una promesa de respuesta inmediata. Las vías y condiciones de revisión deben coincidir con la capacidad real del equipo y los requisitos aplicables."},
          {"Código y servicio",
           "El código de Cherry se distribuye con licencia AGPL-3.0. Esa licencia no convierte en públicos tus datos ni autoriza su reutilización. Cada instancia independiente debe identificar a su propio operador y explicar sus prácticas."},
          {"Texto pendiente de aprobación",
           "Antes de abrir al público deben completarse la identidad del titular, condiciones definitivas de operación y las cláusulas aplicables. Este documento es un borrador de trabajo, no una renuncia a derechos legales."}
        ]
      },
      %{
        slug: "normas",
        title: "Normas de comunidad",
        intro: "Conocer gente debería sentirse bien. Cuidarnos forma parte de ello.",
        sections: [
          {"Respeto y consentimiento",
           "No se permiten acoso, amenazas, discriminación, presión sexual ni difusión de información privada. Un match no implica consentimiento para nada más."},
          {"Personas reales",
           "No suplantes identidades, no uses documentos prestados y no utilices Cherry para estafar, enviar spam o captar contactos comerciales."},
          {"Contenido permitido",
           "No publiques pornografía, imágenes íntimas sin consentimiento ni contenido de explotación o abuso sexual infantil. No facilites prostitución, trata ni actividades ilegales."},
          {"Bloquear y reportar",
           "Puedes bloquear y reportar desde la aplicación. Explica qué ocurrió sin añadir documentos, conversaciones o datos de terceros que no sean necesarios. El equipo recibe el reporte; no se impone una sanción por acumular denuncias automáticamente."},
          {"Quién revisa",
           "Las decisiones actuales son humanas. No hay agentes de IA resolviendo reclamaciones. El buzón permite consultar el estado, la respuesta y las opciones de revisión disponibles."}
        ]
      },
      %{
        slug: "seguridad-infantil",
        title: "Seguridad infantil",
        intro: "Cherry es para adultos. La protección de menores también nos concierne.",
        sections: [
          {"Prohibición expresa",
           "Está prohibida cualquier forma de explotación y abuso sexual infantil: material de abuso sexual infantil, captación sexual de menores, extorsión sexual, trata y conductas que los pongan en peligro."},
          {"Cómo avisar",
           "Utiliza Reportar en la app y selecciona Posible menor cuando corresponda. Si no tienes acceso, utiliza el contacto público. No envíes ni descargues material ilegal para acompañar el aviso."},
          {"Cómo actuar",
           "Los posibles menores reciben prioridad en el panel. El equipo debe restringir el acceso, retirar contenido y comunicarlo a las autoridades competentes cuando corresponda, evitando copias y difusión innecesarias. Las fotos y el procedimiento operativo todavía requieren validación antes de abrir."},
          {"Contacto responsable",
           "El operador debe designar un contacto preparado para atender cuestiones de seguridad infantil y declararlo en las tiendas. La publicación de este borrador no acredita que ese circuito ya esté operativo."}
        ]
      },
      %{
        slug: "transparencia",
        title: "Cómo funciona Cherry",
        intro: "Transparencia significa explicar lo que hacemos, también sus límites.",
        sections: [
          {"Sin monetización",
           "El proyecto no incluye suscripciones, publicidad ni venta de datos. Las funciones sociales se ofrecen sin pagos dentro de la aplicación."},
          {"Compatibilidad comprensible",
           "Las preferencias y etiquetas determinan qué perfiles aparecen. Los bloqueos se aplican en ambas direcciones. No se paga por aparecer antes ni por ver quién te ha dado like."},
          {"Atención humana",
           "El backoffice separa moderación, privacidad y administración. Los permisos del equipo son explícitos y revocables. Las consultas y decisiones se registran; los registros vinculados a una cuenta también forman parte de su borrado."},
          {"Qué no prometemos",
           "Código abierto no significa seguridad absoluta, cifrado de extremo a extremo ni borrado remoto de capturas que otras personas hayan realizado. Los textos y las funciones deben describir el estado real de cada instancia."}
        ]
      }
    ]
  end

  def document(slug), do: Enum.find(documents(), &(&1.slug == slug))
end
