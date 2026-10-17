/**
 * Qué pasa de verdad al borrar la cuenta (`DELETE /api/me/account` → `Accounts.delete_account/1`):
 * se elimina físicamente la cuenta y sus datos vinculados, incluidas la identidad de
 * acceso y la huella del documento. El almacenamiento externo tiene reintentos durables.
 * Un registro nuevo puede usar el mismo DNI, sin recuperar la cuenta anterior.
 */
export const deleteAccountConsequences = [
  "Eliminamos tu cuenta, perfil, mensajes y expedientes vinculados. Tus conversaciones desaparecen también para la otra persona.",
  "Cerramos todas tus sesiones y eliminamos tu correo y la huella del DNI. Podrás registrarte de nuevo desde cero con el mismo documento.",
  "Ordenamos borrar tus fotos y reintentamos si el almacenamiento falla. El borrado de archivos y copias no siempre es instantáneo."
] as const;

export const FAREWELL_MESSAGE = "Nos da pena verte ir, pero lo entendemos.";
