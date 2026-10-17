import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { CASE_PAGE_SIZE, type CreateSupportCaseRequest, type SupportCase } from "@cherry/contracts";
import { createCaseworkApi } from "@cherry/mobile-shared";
import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";
import { useAuthedApi } from "../../auth/presentation";

export function useSupportInbox() {
  const callApi = useAuthedApi(createCaseworkApi);
  const [page, setPage] = useState<{ cases: SupportCase[]; offset: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mounted = useRef(false);
  const request = useRef(0);
  const currentOffset = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, []);

  const loadPage = useCallback(
    async (offset: number) => {
      const revision = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const result = await callApi((api) => api.list(offset));
        if (mounted.current && revision === request.current) {
          currentOffset.current = offset;
          setPage({ cases: result.cases, offset });
        }
      } catch (err) {
        if (mounted.current && revision === request.current)
          setError(friendlyErrorMessage(err, "No hemos podido cargar tu buzón. Vuelve a intentarlo."));
      } finally {
        if (mounted.current && revision === request.current) setLoading(false);
      }
    },
    [callApi]
  );

  const refresh = useCallback(() => loadPage(currentOffset.current), [loadPage]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        request.current += 1;
      };
    }, [refresh])
  );

  const send = useCallback(
    async (input: CreateSupportCaseRequest | { appealId: string; statement: string }) => {
      if (busy.current) return false;
      busy.current = true;
      setPending(true);
      setSendError(null);
      try {
        const result = await callApi((api) =>
          "appealId" in input ? api.appeal(input.appealId, input.statement) : api.create(input)
        );
        if (!mounted.current) return false;
        // Invalidate a list request that began before this successful mutation.
        request.current += 1;
        setLoading(false);
        currentOffset.current = 0;
        setPage((current) => ({
          offset: 0,
          cases: [
            result.case,
            ...(current?.offset === 0 ? current.cases.filter((item) => item.id !== result.case.id) : [])
          ].slice(0, CASE_PAGE_SIZE)
        }));
        void loadPage(0);
        return true;
      } catch (err) {
        if (mounted.current) {
          const code = apiErrorCode(err);
          setSendError(
            code === "case_rate_limited"
              ? "Has enviado varias solicitudes hoy. Revisa las que ya tienes abiertas e inténtalo más tarde."
              : code === "case_conflict"
                ? "Este expediente ya cambió o tiene un recurso presentado. Actualiza el buzón antes de continuar."
                : friendlyErrorMessage(
                    err,
                    "No hemos podido enviar tu solicitud. El texto sigue aquí para que puedas reintentarlo."
                  )
          );
        }
        return false;
      } finally {
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [callApi, loadPage]
  );

  const clearSendError = useCallback(() => setSendError(null), []);
  return { page, loading, error, sendError, clearSendError, pending, loadPage, refresh, send };
}
