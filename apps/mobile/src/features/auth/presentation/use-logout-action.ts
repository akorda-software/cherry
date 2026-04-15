import { useCallback } from "react";
import { useRouter } from "expo-router";

import { appShellRoutes } from "../../../shared/ui/app-shell/routes";
import { useSessionShell } from "./session-shell-provider";

export function useLogoutAction() {
  const router = useRouter();
  const { signOut } = useSessionShell();

  return useCallback(async () => {
    await signOut();
    router.replace(appShellRoutes.login);
  }, [router, signOut]);
}
