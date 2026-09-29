import { useCallback } from "react";
import { useRouter } from "expo-router";

import { createSettingsApi } from "@snack/mobile-shared";

import { appShellRoutes, toast } from "../../../shared/ui";
import { useAuthedApi, useSessionShell } from "../../auth/presentation";
import { type DeleteAccountAction, useDeleteAccount } from "../application/use-delete-account";
import { FAREWELL_MESSAGE } from "../domain/delete-account";

/**
 * `DELETE /api/me/account` → limpia la sesión local → vuelve a la bienvenida con una
 * despedida cálida (el `ToastHost` vive en la raíz, así que se ve en el login).
 */
export function useDeleteAccountAction(): DeleteAccountAction {
  const router = useRouter();
  const callApi = useAuthedApi(createSettingsApi);
  const { signOut } = useSessionShell();

  const deleteAccount = useCallback(() => callApi((api) => api.deleteAccount()), [callApi]);
  const onDeleted = useCallback(() => {
    toast.show({ message: FAREWELL_MESSAGE, tone: "love", icon: "heart" });
    router.replace(appShellRoutes.login);
  }, [router]);

  return useDeleteAccount({ deleteAccount, signOut, onDeleted });
}
