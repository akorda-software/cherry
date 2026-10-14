/**
 * Qué pasa de verdad al borrar la cuenta (`DELETE /api/me/account` → `Accounts.delete_account/1`):
 * la cuenta se desactiva, el perfil deja de verse en Descubrir, Likes y los chats de otras
 * personas, y se cierran todas las sesiones. Volver a entrar con la misma cuenta de Google o
 * Apple borra la anterior del todo y empieza una nueva (`Cherry.Identity`).
 */
export const deleteAccountConsequences = [
  "Tu perfil deja de verse: nadie te encontrará en Descubrir, en Likes ni en sus chats.",
  "Cerramos tu sesión en todos tus dispositivos.",
  "Si vuelves a entrar, empezarás de cero con una cuenta nueva: no se recupera nada de esta."
] as const;

export const FAREWELL_MESSAGE = "Nos da pena verte ir, pero lo entendemos.";
