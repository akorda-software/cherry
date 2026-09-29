import { ActivitySummaryHost } from "../activity/application/use-activity-summary";
import { MatchCelebrationHost } from "../match/presentation/match-celebration-host";

/**
 * Overlays globales de la zona privada (montados una vez en app/(app)/_layout.tsx).
 * - Celebración de match: cualquier pantalla llama `useMatchCelebrationStore.getState().show(match)`.
 * - Badges de Likes y Chats: `ActivitySummaryHost` consulta `GET /api/me/summary` (no pinta nada).
 */
export function AppOverlays() {
  return (
    <>
      <ActivitySummaryHost />
      <MatchCelebrationHost />
    </>
  );
}
