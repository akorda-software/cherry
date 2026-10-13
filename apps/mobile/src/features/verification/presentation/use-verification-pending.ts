import { isAgeVerificationPending, useAppBootstrap } from "../../app-bootstrap";

/** `true` si la instancia exige verificarse y esta cuenta aún no lo ha hecho. */
export function useVerificationPending(): boolean {
  const { state } = useAppBootstrap();
  return state.status === "ready" && isAgeVerificationPending(state.bootstrap);
}
