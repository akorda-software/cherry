import { type ReactNode, useState } from "react";
import { useRouter } from "expo-router";

import {
  appShellRoutes,
  Button,
  ConfirmSheet,
  ErrorState,
  type PastelName,
  Screen,
  SkeletonGroup,
  SkeletonText,
  toast,
  TopBar
} from "../../../../shared/ui";

export interface EditScaffoldProps {
  title: string;
  testID: string;
  children?: ReactNode;
  tone?: PastelName;
  /** Hay cambios sin guardar: al salir se pregunta. */
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  onSave(): void;
  saveLabel?: string;
  loading: boolean;
  failed: boolean;
  onRetry(): void;
  /** Contenido desplazable (por defecto sí). */
  scroll?: boolean;
  /** Fijo bajo la barra superior (pestañas, estante…). */
  subheader?: ReactNode;
  /** Fuerza el estado del botón (p. ej. «Listo» en fotos, que guardan al momento). */
  saveEnabled?: boolean;
}

/** Vuelve a la pantalla anterior (o a «Yo» si se entró directo). */
export function useLeaveEdit() {
  const router = useRouter();

  return () => {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
    } else {
      router.replace(appShellRoutes.me);
    }
  };
}

/** Aviso estándar tras guardar una edición. */
export function toastSaved() {
  toast.show({ message: "¡Guardado!", tone: "success" });
}

/**
 * Marco de las pantallas de edición del perfil: cabecera con atrás (pregunta
 * antes de descartar cambios), contenido y botón de guardar fijo abajo.
 */
export function EditScaffold({
  title,
  testID,
  children,
  tone,
  dirty,
  canSave,
  saving,
  onSave,
  saveLabel = "Guardar",
  loading,
  failed,
  onRetry,
  scroll = true,
  subheader,
  saveEnabled
}: EditScaffoldProps) {
  const leave = useLeaveEdit();
  const [confirming, setConfirming] = useState(false);

  return (
    <Screen
      footer={
        loading || failed ? undefined : (
          <Button
            disabled={!(saveEnabled ?? (canSave && dirty))}
            fullWidth
            loading={saving}
            onPress={onSave}
            size="lg"
            testID={`${testID}-save`}
          >
            {saveLabel}
          </Button>
        )
      }
      header={
        <>
          <TopBar
            fallbackHref={appShellRoutes.me}
            left="back"
            onBack={() => (dirty && !saving ? setConfirming(true) : leave())}
            testID={`${testID}-top-bar`}
            title={title}
          />
          {!loading && !failed ? subheader : null}
        </>
      }
      scroll={scroll}
      testID={testID}
      tone={tone}
    >
      {failed ? (
        <ErrorState
          message="No hemos podido cargar tu perfil. Revisa tu conexión y vuelve a probar."
          onRetry={onRetry}
          testID={`${testID}-error`}
        />
      ) : loading ? (
        <SkeletonGroup>
          <SkeletonText lines={5} />
        </SkeletonGroup>
      ) : (
        children
      )}
      <ConfirmSheet
        cancelLabel="Seguir editando"
        confirmLabel="Salir sin guardar"
        message="Si sales ahora, se pierden los cambios."
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          leave();
        }}
        testID={`${testID}-discard`}
        title="¿Salir sin guardar?"
        visible={confirming}
      />
    </Screen>
  );
}
