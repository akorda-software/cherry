import { useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import {
  appShellRoutes,
  Button,
  ErrorState,
  FormMessage,
  Icon,
  IconSlot,
  Inline,
  ListRow,
  ListSection,
  LoadingDots,
  PressableScale,
  RangeSlider,
  Screen,
  Stack,
  Text,
  toast,
  TopBar,
  useTheme
} from "../../../../shared/ui";
import { discoveryPreferencesStore, discoveryQueueStore } from "../../application/discovery-runtime";
import { useFiltersForm } from "../../application/use-filters-form";
import {
  ageRangeLabel,
  DISTANCE_OPTIONS,
  distanceLabel,
  FILTER_AGE_MAX,
  FILTER_AGE_MIN,
  INTERESTED_IN_OPTIONS
} from "../../domain/filters";
import { useDiscoveryRuntime } from "../use-discovery-runtime";

const DEPS = { preferences: discoveryPreferencesStore, queue: discoveryQueueStore };

/** Filtros de Descubrir (modal): edad, distancia, a quién conocer y dos preferencias. Todo gratis. */
export function FiltersScreen() {
  useDiscoveryRuntime();
  const router = useRouter();
  const form = useFiltersForm(DEPS);

  const close = useCallback(() => {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
    } else {
      router.replace(appShellRoutes.discover);
    }
  }, [router]);

  const save = useCallback(async () => {
    const wasDirty = form.dirty;
    const ok = await form.save();

    if (ok) {
      if (wasDirty) {
        toast.show({ message: "Filtros guardados. Buscando gente nueva…", tone: "success", icon: "sliders" });
      }

      close();
    }
  }, [close, form]);

  const header = <TopBar left="close" testID="filters-top-bar" title="Filtros" />;

  if (form.status === "error") {
    return (
      <Screen header={header} testID="filters-screen" tone="lavanda">
        <ErrorState message="No hemos podido cargar tus filtros." onRetry={form.retryLoad} testID="filters-error" />
      </Screen>
    );
  }

  if (form.status !== "ready") {
    return (
      <Screen header={header} testID="filters-screen" tone="lavanda">
        <View accessibilityLabel="Cargando tus filtros" style={styles.loading}>
          <LoadingDots />
        </View>
      </Screen>
    );
  }

  const { draft } = form;

  return (
    <Screen
      footer={
        <Stack gap="xs">
          {form.error ? <FormMessage tone="error">{form.error}</FormMessage> : null}
          <Button
            fullWidth
            icon="check"
            loading={form.saving}
            onPress={() => void save()}
            size="lg"
            testID="filters-save"
          >
            {form.dirty ? "Guardar filtros" : "Listo"}
          </Button>
        </Stack>
      }
      gap="xl"
      header={header}
      scroll
      testID="filters-screen"
      tone="lavanda"
    >
      <FreeNote />

      <Section title="Edad" value={ageRangeLabel(draft)}>
        <RangeSlider
          formatLabel={(value) => String(value)}
          high={draft.ageMax}
          highLabel="Edad máxima"
          low={draft.ageMin}
          lowLabel="Edad mínima"
          max={FILTER_AGE_MAX}
          min={FILTER_AGE_MIN}
          minGap={1}
          onChange={form.setAgeRange}
          testID="filters-age"
        />
      </Section>

      <Section title="Distancia" value={distanceLabel(draft.distanceKm)}>
        <Inline accessibilityRole="radiogroup" gap="sm">
          {DISTANCE_OPTIONS.map((km) => (
            <ChoiceChip
              key={km}
              kind="radio"
              label={distanceLabel(km)}
              onPress={() => form.setDistance(km)}
              selected={draft.distanceKm === km}
              testID={`filters-distance-${km}`}
            />
          ))}
        </Inline>
      </Section>

      <Section hint="Elige al menos una opción." title="A quién quieres conocer">
        <Inline gap="sm">
          {INTERESTED_IN_OPTIONS.map((option) => {
            const selected = draft.interestedIn.includes(option.value);
            const last = selected && draft.interestedIn.length === 1;

            return (
              <ChoiceChip
                key={option.value}
                hint={last ? "Tiene que quedar al menos una opción" : undefined}
                kind="checkbox"
                label={option.label}
                onPress={() => form.toggleInterestedIn(option.value)}
                selected={selected}
                testID={`filters-gender-${option.value}`}
              />
            );
          })}
        </Inline>
      </Section>

      <ListSection>
        <ListRow
          description="Si se acaban por tu zona, te enseñamos a gente algo más lejos (siempre después)."
          icon="pin"
          iconColor="cielo"
          label="Enseñarme gente algo más lejos si se acaban"
          onSwitchChange={form.setExpandDistance}
          switchValue={draft.expandDistance}
          testID="filters-expand-distance"
        />
        <ListRow
          description="Solo verás a quien comparta alguna etiqueta contigo."
          icon="sparkles"
          iconColor="limonada"
          label="Solo personas con etiquetas en común"
          onSwitchChange={form.setCompatibleOnly}
          switchValue={draft.compatibleOnly}
          testID="filters-compatible-only"
        />
      </ListSection>
    </Screen>
  );
}

function FreeNote() {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.free,
        {
          backgroundColor: theme.primitives.pastel.menta.soft,
          borderColor: theme.primitives.color.ink,
          borderWidth: theme.primitives.border.thin,
          borderRadius: theme.primitives.radius.md
        }
      ]}
      testID="filters-free-note"
    >
      <Icon fill={theme.primitives.color.menta} name="gift" size={22} />
      <Text style={styles.flex} variant="callout">
        Gratis, como todo aquí. En otras apps esto se paga.
      </Text>
    </View>
  );
}

function Section({ title, value, hint, children }: { title: string; value?: string; hint?: string; children: React.ReactNode }) {
  return (
    <Stack gap="md">
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" variant="title3">
          {title}
        </Text>
        {value ? (
          <Text accessibilityLiveRegion="polite" color="accent" variant="label">
            {value}
          </Text>
        ) : null}
      </View>
      {hint ? (
        <Text color="muted" style={styles.hint} variant="caption">
          {hint}
        </Text>
      ) : null}
      {children}
    </Stack>
  );
}

function ChoiceChip({
  label,
  selected,
  kind,
  hint,
  onPress,
  testID
}: {
  label: string;
  selected: boolean;
  kind: "radio" | "checkbox";
  hint?: string;
  onPress(): void;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.primitives.color;

  return (
    <PressableScale
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole={kind}
      accessibilityState={{ checked: selected }}
      elevation={selected ? "sm" : "xs"}
      faceStyle={[
        styles.chip,
        {
          backgroundColor: selected ? c.limonada : c.white,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.regular
        }
      ]}
      haptic="selection"
      onPress={onPress}
      pressedScale={0.97}
      releaseSpring="pop"
      testID={testID}
    >
      {selected ? <IconSlot color={c.ink} icon="check" size={16} /> : null}
      <Text maxFontSizeMultiplier={1.3} variant="label">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240
  },
  free: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12
  },
  hint: {
    marginTop: -6
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22
  }
});
