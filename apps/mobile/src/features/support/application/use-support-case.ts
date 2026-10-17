import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { SupportCase } from "@cherry/contracts";
import { createCaseworkApi } from "@cherry/mobile-shared";
import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";
import { useAuthedApi } from "../../auth/presentation";

/** Detail has its own authoritative fetch: it cannot depend on the current list page. */
export function useSupportCase(initial: SupportCase) {
  const callApi = useAuthedApi(createCaseworkApi);
  const [record, setRecord] = useState<SupportCase | null>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const active = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true);
    setError(null);
    try {
      const result = await callApi((api) => api.get(initial.id));
      if (active.current && request === revision.current) setRecord(result.case);
    } catch (err) {
      if (active.current && request === revision.current) {
        if (apiErrorCode(err) === "case_not_found") setRecord(null);
        setError(
          friendlyErrorMessage(err, "No hemos podido actualizar el expediente. Reintenta antes de pedir una revisión.")
        );
      }
    } finally {
      if (active.current && request === revision.current) setLoading(false);
    }
  }, [callApi, initial.id]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void refresh();
      return () => {
        active.current = false;
        revision.current += 1;
      };
    }, [refresh])
  );
  return { record, loading, error, refresh };
}
