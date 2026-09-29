/**
 * Qué pasa de verdad al borrar la cuenta (`DELETE /api/me/account` → `Accounts.delete_account/1`):
 * la cuenta se desactiva y no admite nuevos accesos, el perfil deja de verse en Descubrir, Likes
 * y los chats de otras personas, y se cierran todas las sesiones.
 */
export const deleteAccountConsequences = [
  "Tu perfil deja de verse: nadie te encontrará en Descubrir, en Likes ni en sus chats.",
  "Cerramos tu sesión en todos tus dispositivos.",
  "Tu cuenta queda desactivada y no se podrá volver a usar para entrar."
] as const;

export const FAREWELL_MESSAGE = "Nos da pena verte ir, pero lo entendemos.";
