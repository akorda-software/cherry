import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import type { Tag } from "@snack/contracts";
import { createProfileApi, type ProfileApi } from "@snack/mobile-shared";

import { refreshBootstrap } from "../../../features/app-bootstrap/presentation/app-bootstrap-provider";
import { useSessionShell } from "../../auth/presentation";
import { useRuntimeConfig } from "../../../shared/config";
import { createJsonHttpClient } from "../../../shared/api";
import { Button, useTheme } from "../../../shared/ui";
import { useTagSelection } from "../application/use-tag-selection";
import { TagPicker } from "./tag-picker";

type LoadStatus = "loading" | "ready" | "error";

export function TagSelectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { executeAuthenticated } = useSessionShell();
  const { apiBaseUrl } = useRuntimeConfig();
  const { reset } = useTagSelection();

  const callApi = useCallback(
    <T,>(run: (api: ProfileApi) => Promise<T>) =>
      executeAuthenticated((token) => {
        const client = createJsonHttpClient({
          apiBaseUrl,
          getHeaders: () => ({ Authorization: `Bearer ${token}` })
        });
        return run(createProfileApi(client));
      }),
    [apiBaseUrl, executeAuthenticated]
  );

  const [catalog, setCatalog] = useState<Tag[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const selection = useTagSelection();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setStatus("loading");
      setLoadError(null);

      try {
        const [tags, positive, blocked] = await Promise.all([
          callApi((api) => api.getTagCatalog()),
          callApi((api) => api.getPositiveTags()),
          callApi((api) => api.getBlockedTags())
        ]);

        if (cancelled) {
          return;
        }

        setCatalog(tags);
        reset({
          positive: positive.map((tag) => tag.id),
          blocked: blocked.map((tag) => tag.id)
        });
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las etiquetas");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callApi, reset]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await callApi((api) => api.setPositiveTags(selection.positiveIds));
      await callApi((api) => api.setBlockedTags(selection.blockedIds));
      setSavedAt(Date.now());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudieron guardar las etiquetas");
    } finally {
      setSaving(false);
    }
  }, [callApi, selection.positiveIds, selection.blockedIds]);

  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    setFinalizeError(null);

    try {
      await callApi((api) => api.setPositiveTags(selection.positiveIds));
      await callApi((api) => api.setBlockedTags(selection.blockedIds));
      setSavedAt(Date.now());

      const result = await callApi((api) => api.completeProfile());

      if (result.onboardingRequired === false) {
        await refreshBootstrap();
        router.replace("/(app)/(tabs)/home");
        return;
      }

      setFinalizeError("Todavía faltan campos. Revisá los pasos anteriores.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo finalizar";
      setFinalizeError(message);
    } finally {
      setFinalizing(false);
    }
  }, [callApi, router, selection.blockedIds, selection.positiveIds]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: theme.semantic.color.screenBackground
        },
        scroll: {
          flexGrow: 1,
          padding: theme.primitives.spacing.lg,
          gap: theme.primitives.spacing.lg
        },
        title: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.title.fontSize,
          fontWeight: "800" as any
        },
        intro: {
          color: theme.semantic.text.muted,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: theme.primitives.typography.body.fontWeight as any,
          lineHeight: theme.primitives.typography.body.fontSize * 1.4
        },
        counters: {
          flexDirection: "row",
          gap: theme.primitives.spacing.sm
        },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.primitives.spacing.xs,
          paddingVertical: theme.primitives.spacing.xs,
          paddingHorizontal: theme.primitives.spacing.sm,
          borderRadius: theme.primitives.radius.pill,
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          backgroundColor: theme.semantic.color.surfaceBackground
        },
        chipLabel: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "800" as any
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: theme.primitives.spacing.md,
          padding: theme.primitives.spacing.xl
        },
        message: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.body.fontSize,
          textAlign: "center"
        },
        success: {
          color: theme.semantic.state.success,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "700" as any
        },
        error: {
          color: theme.semantic.state.danger,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "700" as any
        },
        footer: {
          gap: theme.primitives.spacing.sm
        }
      }),
    [theme]
  );

  if (status === "loading") {
    return (
      <View style={[styles.root, styles.center]} testID="tag-selection-loading">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={[styles.root, styles.center]} testID="tag-selection-error">
        <Text style={styles.message}>{loadError}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} testID="tag-selection">
      <Text style={styles.title}>Tus etiquetas</Text>
      <Text style={styles.intro}>
        Toca el corazón para lo que te representa y la X para lo que no quieres ver. Máximo{" "}
        {selection.maxPositive} gustos y {selection.maxBlocked} bloqueos.
      </Text>
      <View style={styles.counters}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>
            ♥ {selection.positiveCount}/{selection.maxPositive}
          </Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>
            ✕ {selection.blockedCount}/{selection.maxBlocked}
          </Text>
        </View>
      </View>
      <TagPicker
        catalog={catalog}
        stateOf={selection.stateOf}
        positiveFull={selection.positiveFull}
        blockedFull={selection.blockedFull}
        onToggleLike={selection.toggleLike}
        onToggleBlock={selection.toggleBlock}
      />
      <View style={styles.footer}>
        {savedAt !== null && saveError === null ? (
          <Text style={styles.success}>Etiquetas guardadas</Text>
        ) : null}
        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
        <Button disabled={saving || finalizing} onPress={() => void handleSave()}>
          {saving ? "Guardando…" : "Guardar etiquetas"}
        </Button>
        {finalizeError ? <Text style={styles.error}>{finalizeError}</Text> : null}
        <Button
          tone="destructive"
          disabled={saving || finalizing}
          onPress={() => void handleFinalize()}
        >
          {finalizing ? "Finalizando…" : "Finalizar y entrar"}
        </Button>
      </View>
    </ScrollView>
  );
}
