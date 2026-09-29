import { useCallback, useEffect, useRef, useState } from "react";

import { haptics } from "../../../shared/ui";
import { stepSaveErrorMessage } from "../application/step-actions";

/**
 * Guardado de un paso: evita dobles toques, expone `busy` para el botón y
 * traduce el error a un mensaje amable (con háptico de error en el móvil).
 */
export function useStepSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (task: () => Promise<void>, toMessage: (error: unknown) => string = stepSaveErrorMessage) => {
    if (busyRef.current) {
      return false;
    }

    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      await task();
      return true;
    } catch (caught) {
      if (mounted.current) {
        setError(toMessage(caught));
      }
      haptics.error();
      return false;
    } finally {
      busyRef.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }, []);

  return { busy, error, setError, run };
}
