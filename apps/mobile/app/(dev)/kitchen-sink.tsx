import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Redirect } from "expo-router";
import { type PropsWithChildren, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import {
  Appear,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmSheet,
  Divider,
  EmptyState,
  ErrorState,
  Heading,
  Icon,
  IconButton,
  KawaiiTabBar,
  Inline,
  ListRow,
  ListSection,
  LoadingDots,
  type PastelName,
  Pill,
  PopIn,
  ProgressBar,
  RangeSlider,
  Screen,
  SegmentedControl,
  Sheet,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  Slider,
  Stack,
  Surface,
  Switch,
  tabItems,
  TagSticker,
  type TagStickerState,
  Text,
  TextField,
  type TextVariant,
  TopBar,
  useShake,
  useTheme,
  useToast,
  Wiggle
} from "../../src/shared/ui";

const PASTELS: PastelName[] = ["fresa", "menta", "lavanda", "limonada", "cielo", "melocoton", "tomate"];
const VARIANTS: TextVariant[] = [
  "hero",
  "title1",
  "title2",
  "title3",
  "body",
  "bodyStrong",
  "callout",
  "label",
  "caption",
  "micro",
  "button",
  "hand",
  "stamp",
  "numeral"
];
const STATES: TagStickerState[] = ["neutral", "selected", "blocked", "shared", "muted"];

/** Escaparate solo-dev del sistema de diseño (todas las piezas en todos sus estados). */
export default function KitchenSinkRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <KitchenSink />;
}

function Section({ title, children, testID }: PropsWithChildren<{ title: string; testID?: string }>) {
  return (
    <View style={styles.section} testID={testID}>
      <Heading level={2}>{title}</Heading>
      {children}
    </View>
  );
}

function KitchenSink() {
  const theme = useTheme();
  const toast = useToast();
  const [mode, setMode] = useState<"swipe" | "feed">("swipe");
  const [tags, setTags] = useState<Record<string, TagStickerState>>({
    yoga: "selected",
    cafe: "neutral",
    gatos: "neutral",
    fumar: "blocked"
  });
  const [notify, setNotify] = useState(true);
  const [paused, setPaused] = useState(false);
  const [age, setAge] = useState({ low: 24, high: 35 });
  const [distance, setDistance] = useState(25);
  const [name, setName] = useState("Lucía");
  const [bio, setBio] = useState("Me encantan los mercadillos de los domingos y el café con canela.");
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [wiggle, setWiggle] = useState(0);
  const [pop, setPop] = useState(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(3);
  const { shake, style: shakeStyle } = useShake();

  function cycle(key: string) {
    setTags((current) => {
      const order: TagStickerState[] = key === "fumar" ? ["neutral", "blocked"] : ["neutral", "selected"];
      const now = current[key] ?? "neutral";
      const next = order[(order.indexOf(now) + 1) % order.length] ?? "neutral";
      return { ...current, [key]: next };
    });
  }

  return (
    <Screen
      header={
        <TopBar
          left="back"
          right={<IconButton accessibilityLabel="Filtros" badge={2} icon="sliders" size="sm" />}
          title="Kitchen sink"
        />
      }
      scroll
      testID="kitchen-sink"
    >
      <Section title="Tipografía">
        {VARIANTS.map((variant) => (
          <Text key={variant} variant={variant}>
            {variant} · Conoce gente cerca
          </Text>
        ))}
        <Inline>
          <Text color="muted">muted</Text>
          <Text color="faint">faint</Text>
          <Text color="accent">accent</Text>
          <Text color="danger">danger</Text>
          <Text color="success">success</Text>
        </Inline>
      </Section>

      <Section title="Pasteles">
        <View style={styles.swatches}>
          {PASTELS.map((pastel) => (
            <View key={pastel} style={styles.swatchColumn}>
              {(["fill", "soft", "deep"] as const).map((tone) => (
                <View
                  key={tone}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: theme.primitives.pastel[pastel][tone],
                      borderColor: theme.primitives.color.ink,
                      borderWidth: theme.primitives.border.thin
                    }
                  ]}
                />
              ))}
              <Text variant="micro">{pastel}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section testID="ks-buttons" title="Botones">
        <Button fullWidth icon="heart" size="lg">
          Empezar
        </Button>
        <Inline gap="md">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
        </Inline>
        <Inline gap="md">
          <Button variant="soft">Suave</Button>
          <Button variant="danger">Borrar</Button>
          <Button variant="ink">Tinta</Button>
        </Inline>
        <Inline gap="md">
          <Button color="menta" iconRight="arrow-right">
            Continuar
          </Button>
          <Button variant="ghost">Ahora no</Button>
        </Inline>
        <Inline gap="md">
          <Button icon="camera" size="sm" variant="secondary">
            Añadir foto
          </Button>
          <Button color="limonada" size="sm">
            Pequeño
          </Button>
        </Inline>
        <Inline gap="md">
          <Button
            loading={loading}
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1800);
            }}
            testID="ks-loading-button"
          >
            Guardar
          </Button>
          <Button loading>Guardando</Button>
          <Button disabled>Deshabilitado</Button>
        </Inline>
      </Section>

      <Section title="Botones redondos">
        <View style={styles.actions}>
          <IconButton accessibilityLabel="Paso" color="lavanda" icon="x" size="lg" />
          <IconButton accessibilityLabel="Deshacer" color="limonada" icon="undo" size="md" />
          <IconButton
            accessibilityLabel="Me gusta"
            color="fresa"
            icon="heart"
            iconFill={theme.primitives.color.white}
            size="xl"
          />
        </View>
        <Inline gap="md">
          <IconButton accessibilityLabel="Atrás" icon="arrow-left" size="sm" />
          <IconButton accessibilityLabel="Chats" badge={3} color="cielo" icon="chat" />
          <IconButton accessibilityLabel="Avisos" badge icon="bell" />
          <IconButton accessibilityLabel="Ajustes" color="ink" icon="gear" />
          <IconButton accessibilityLabel="Deshabilitado" disabled icon="trash" />
          <IconButton accessibilityLabel="Marcado" icon="star" selected />
        </Inline>
      </Section>

      <Section testID="ks-tags" title="Pegatinas de etiquetas">
        <Inline gap="sm">
          {STATES.map((state) => (
            <TagSticker emoji="🧘" key={state} label="Yoga" state={state} />
          ))}
        </Inline>
        <Inline gap="sm">
          {STATES.map((state) => (
            <TagSticker emoji="☕" key={state} label="Café" size="sm" state={state} />
          ))}
        </Inline>
        <Inline gap="md">
          <TagSticker emoji="🐱" label="Gatos" size="lg" state="selected" />
          <TagSticker emoji="🎨" label="Arte" size="lg" tint="cielo" />
        </Inline>
        <Text color="muted" variant="caption">
          Pulsa para elegir o bloquear:
        </Text>
        <Inline gap="sm">
          <TagSticker emoji="🧘" label="Yoga" onPress={() => cycle("yoga")} state={tags.yoga} testID="ks-tag-yoga" />
          <TagSticker emoji="☕" label="Café" onPress={() => cycle("cafe")} state={tags.cafe} testID="ks-tag-cafe" />
          <TagSticker emoji="🐱" label="Gatos" onPress={() => cycle("gatos")} rotate={-2} state={tags.gatos} />
          <TagSticker emoji="🚬" label="Fumar" onPress={() => cycle("fumar")} state={tags.fumar} />
          <TagSticker disabled emoji="🎮" label="Videojuegos" onPress={() => undefined} />
        </Inline>
        <View style={[styles.photo, { backgroundColor: theme.primitives.pastel.cielo.fill }]}>
          <Inline gap="sm">
            <TagSticker diecut emoji="🌿" label="Senderismo" rotate={-3} size="sm" state="shared" />
            <TagSticker diecut emoji="📚" label="Leer" rotate={2} size="sm" state="shared" />
          </Inline>
        </View>
      </Section>

      <Section title="Insignias, contadores y avatares">
        <Inline gap="sm">
          <Pill color="limonada" icon="sparkle" label="Nuevo" />
          <Pill color="fresa" icon="heart" label="Te ha dado like" />
          <Pill color="menta" icon="tag" label="3 en común" />
          <Pill color="cielo" icon="pin" label="Un poco más lejos" />
          <Pill icon="clock" label="Caduca en 30 días" size="sm" />
        </Inline>
        <Inline gap="md">
          <Badge count={1} />
          <Badge count={12} />
          <Badge count={120} />
          <Badge color="ink" count={4} />
          <Badge dot />
        </Inline>
        <Inline align="flex-end" gap="md">
          <Avatar name="Lucía" size="xs" />
          <Avatar name="Marta" size="sm" />
          <Avatar name="Dani" size="md" />
          <Avatar name="Alex" ring size="md" />
          <Avatar elevation="md" name="Sam" ring="menta" size="lg" />
        </Inline>
      </Section>

      <Section title="Conmutador">
        <SegmentedControl
          onChange={setMode}
          options={[
            { value: "swipe", label: "Swipe", icon: "cards", testID: "ks-mode-swipe" },
            { value: "feed", label: "Feed", icon: "feed", testID: "ks-mode-feed" }
          ]}
          testID="ks-segmented"
          value={mode}
        />
        <SegmentedControl
          color="menta"
          fullWidth
          onChange={() => undefined}
          options={[
            { value: "a", label: "Relación" },
            { value: "b", label: "Casual" },
            { value: "c", label: "A ver qué pasa" }
          ]}
          size="sm"
          value="c"
        />
      </Section>

      <Section testID="ks-fields" title="Campos">
        <TextField
          hint="Así te verán los demás."
          label="¿Cómo te llamas?"
          onChangeText={setName}
          placeholder="Tu nombre"
          size="xl"
          value={name}
        />
        <TextField icon="search" label="Buscar" placeholder="Busca una conversación" />
        <TextField
          counter
          label="Tu bio"
          maxLength={240}
          multiline
          onChangeText={setBio}
          placeholder="Cuéntanos algo que te haga sonreír"
          value={bio}
        />
        <Animated.View style={shakeStyle}>
          <TextField
            error={error}
            label="Correo"
            placeholder="hola@cherry.dev"
            testID="ks-email"
            value="hola@"
          />
        </Animated.View>
        <Inline gap="md">
          <Button
            onPress={() => setError(error ? null : "Ese correo no parece completo. Revisa la arroba.")}
            size="sm"
            testID="ks-toggle-error"
            variant="secondary"
          >
            Alternar error
          </Button>
          <Button onPress={shake} size="sm" variant="soft">
            Sacudir
          </Button>
        </Inline>
        <TextField editable={false} label="Deshabilitado" value="No editable" />
      </Section>

      <Section title="Interruptores y deslizadores">
        <Inline gap="lg">
          <Switch accessibilityLabel="Avisos" onValueChange={setNotify} value={notify} />
          <Switch accessibilityLabel="Pausa" color="lavanda" onValueChange={setPaused} value={paused} />
          <Switch accessibilityLabel="Deshabilitado" disabled value />
        </Inline>
        <View style={styles.sliderHead}>
          <Text variant="label">Edad</Text>
          <Text variant="label">{`${age.low} – ${age.high}`}</Text>
        </View>
        <RangeSlider
          high={age.high}
          labels="always"
          low={age.low}
          max={99}
          min={18}
          minGap={2}
          onChange={(low, high) => setAge({ low, high })}
          testID="ks-age"
        />
        <View style={styles.sliderHead}>
          <Text variant="label">Distancia</Text>
          <Text variant="label">{`hasta ${distance} km`}</Text>
        </View>
        <Slider color="menta" max={160} min={2} onChange={setDistance} step={1} value={distance} />
      </Section>

      <Section title="Progreso">
        <ProgressBar value={0.35} />
        <ProgressBar color="menta" size="lg" value={0.72} />
        <ProgressBar segments={6} value={step} />
        <Inline gap="md">
          <Button onPress={() => setStep((s) => Math.max(0, s - 1))} size="sm" variant="secondary">
            Paso atrás
          </Button>
          <Button onPress={() => setStep((s) => Math.min(6, s + 1))} size="sm">
            Siguiente paso
          </Button>
        </Inline>
        <LoadingDots />
      </Section>

      <Section title="Superficies">
        <Card description="Las tarjetas de libreta llevan contorno de 3 px y sombra dura." title="Tarjeta">
          <Text>Contenido libre.</Text>
        </Card>
        <Inline gap="md">
          <Surface color="menta" rotate={-2} style={styles.note}>
            <Text variant="hand">¡Hola!</Text>
          </Surface>
          <Surface color="limonada" soft rotate={1.5} style={styles.note}>
            <Text variant="hand">Nota suave</Text>
          </Surface>
          <Surface onPress={() => toast.show({ message: "Tarjeta pulsada", tone: "info" })} style={styles.note}>
            <Text variant="bodyStrong">Púlsame</Text>
          </Surface>
        </Inline>
      </Section>

      <Section title="Listas y ajustes">
        <ListSection footnote="Redondeamos tu ubicación a 500 m. Nunca compartimos la exacta." title="Cuenta">
          <ListRow icon="user" label="Lo básico" onPress={() => undefined} value="Lucía, 29" />
          <ListRow description="Te avisamos de matches y mensajes" icon="bell" label="Avisos" onSwitchChange={setNotify} switchValue={notify} />
          <ListRow icon="moon" iconColor="cielo" label="Tomarme un respiro" onSwitchChange={setPaused} switchValue={paused} />
          <ListRow danger icon="trash" label="Borrar cuenta" onPress={() => setConfirm(true)} />
        </ListSection>
        <Divider label="Separador" />
      </Section>

      <Section title="Cargando">
        <SkeletonGroup>
          <View style={styles.skeletonRow}>
            <Skeleton circle={56} />
            <View style={styles.flex}>
              <SkeletonText lines={2} />
            </View>
          </View>
          <Skeleton color="fresa" height={180} radius={theme.primitives.radius.lg} />
        </SkeletonGroup>
      </Section>

      <Section title="Vacío y error">
        <Surface padding="md" radius="lg">
          <EmptyState
            actionLabel="Ampliar radio"
            compact
            description="Ya has visto a todo el mundo por aquí 🌸 Vuelve en un rato o amplía tu radio."
            mood="sleepy"
            onAction={() => undefined}
            title="No hay nadie más cerca"
          />
        </Surface>
        <ErrorState compact message="No hemos podido cargar los perfiles. Revisa tu conexión." onRetry={() => undefined} />
      </Section>

      <Section title="Movimiento">
        <Inline gap="lg">
          <Wiggle trigger={wiggle || undefined}>
            <Pill color="melocoton" icon="sparkle" label="Meneo" />
          </Wiggle>
          <PopIn rotate={-4} trigger={pop}>
            <Pill color="menta" icon="star" label="Pop" />
          </PopIn>
          <Appear from="bottom" trigger={pop}>
            <Pill color="cielo" icon="leaf" label="Aparece" />
          </Appear>
        </Inline>
        <Inline gap="md">
          <Button onPress={() => setWiggle((n) => n + 1)} size="sm" variant="secondary">
            Menear
          </Button>
          <Button onPress={() => setPop((n) => n + 1)} size="sm" variant="secondary">
            Repetir entrada
          </Button>
        </Inline>
      </Section>

      <Section title="Hojas y avisos">
        <Inline gap="md">
          <Button onPress={() => setSheet(true)} testID="ks-open-sheet" variant="secondary">
            Abrir hoja
          </Button>
          <Button onPress={() => setConfirm(true)} testID="ks-open-confirm" variant="danger">
            Confirmar
          </Button>
        </Inline>
        <Inline gap="sm">
          <Button onPress={() => toast.show({ message: "¡Guardado!", tone: "success" })} size="sm" testID="ks-toast-success" variant="soft">
            Aviso ok
          </Button>
          <Button onPress={() => toast.show({ message: "No hemos podido enviar el mensaje. Reintenta en un momento.", tone: "error" })} size="sm" testID="ks-toast-error" variant="soft">
            Aviso error
          </Button>
          <Button onPress={() => toast.show({ message: "¡Es un match! A Lucía también le gustas.", tone: "love" })} size="sm" testID="ks-toast-love" variant="soft">
            Aviso like
          </Button>
        </Inline>
      </Section>

      <Section testID="ks-tabbar" title="Barra de pestañas">
        {[0, 2].map((active) => (
          <View key={active} style={styles.tabPreview}>
            <KawaiiTabBar {...previewTabBar(active, theme)} />
          </View>
        ))}
      </Section>

      <Section title="Cabeceras">
        <Surface padding={0} radius="lg">
          <TopBar left="back" onBack={() => undefined} right={<IconButton accessibilityLabel="Más" icon="more" size="sm" />} title="Perfil de Lucía" />
        </Surface>
        <Surface padding={0} radius="lg">
          <TopBar size="large" subtitle="Personas a las que les gustas" title="Likes" />
        </Surface>
      </Section>

      <Sheet onClose={() => setSheet(false)} testID="ks-sheet" title="¿Qué buscas?" visible={sheet}>
        <Text color="muted">Elige todo lo que te encaje. «A ver qué pasa» es compatible con todo.</Text>
        <Inline gap="sm">
          <TagSticker label="Relación" onPress={() => undefined} state="selected" />
          <TagSticker label="Algo casual" onPress={() => undefined} />
          <TagSticker label="Conocer gente" onPress={() => undefined} />
          <TagSticker label="A ver qué pasa" onPress={() => undefined} state="selected" />
        </Inline>
        <Button fullWidth onPress={() => setSheet(false)}>
          Listo
        </Button>
      </Sheet>
      <ConfirmSheet
        destructive
        loading={confirming}
        message="Se borrarán tu perfil, tus matches y tus chats. No se puede deshacer."
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirming(true);
          setTimeout(() => {
            setConfirming(false);
            setConfirm(false);
            toast.show({ message: "Hecho. Cuídate mucho.", tone: "neutral" });
          }, 1500);
        }}
        testID="ks-confirm"
        title="¿Borrar tu cuenta?"
        visible={confirm}
        confirmLabel="Sí, borrar"
      />
    </Screen>
  );
}

/** Props falsas para ver la barra de pestañas fuera del navegador de pestañas. */
function previewTabBar(index: number, theme: ReturnType<typeof useTheme>): BottomTabBarProps {
  const p = theme.primitives.pastel;
  const stickers = [p.fresa.fill, p.limonada.fill, p.cielo.fill, p.lavanda.fill];
  const badges: Record<string, number | undefined> = { likes: 3, chats: 12 };
  const routes = tabItems.map((tab) => ({ key: `preview-${tab.name}`, name: tab.name, params: undefined }));
  const descriptors = Object.fromEntries(
    tabItems.map((tab, i) => [
      `preview-${tab.name}`,
      {
        options: {
          title: tab.label,
          tabBarBadge: badges[tab.name],
          tabBarActiveBackgroundColor: stickers[i],
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <Icon color={color} fill={focused ? theme.primitives.color.white : undefined} name={tab.icon} size={26} />
          )
        }
      }
    ])
  );

  return {
    state: { index, routes },
    descriptors,
    navigation: { emit: () => ({ defaultPrevented: true }), navigate: () => undefined },
    insets: { top: 0, right: 0, bottom: 0, left: 0 }
  } as unknown as BottomTabBarProps;
}

const styles = StyleSheet.create({
  tabPreview: {
    height: 96,
    marginHorizontal: -24
  },
  section: {
    gap: 16,
    paddingBottom: 12
  },
  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  swatchColumn: {
    alignItems: "center",
    gap: 4
  },
  swatch: {
    width: 36,
    height: 24,
    borderRadius: 6
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingVertical: 8
  },
  photo: {
    height: 120,
    borderRadius: 16,
    justifyContent: "flex-end",
    padding: 12
  },
  note: {
    minWidth: 96
  },
  sliderHead: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14
  },
  flex: {
    flex: 1
  }
});
