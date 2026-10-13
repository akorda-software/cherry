import { useFonts } from "expo-font";
import { Redirect, useLocalSearchParams } from "expo-router";
import { type PropsWithChildren, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  Confetti,
  Deco,
  decoKinds,
  HeartBurst,
  type HeartBurstHandle,
  Icon,
  iconNames,
  Logo,
  Mascot,
  type MascotMood,
  mascotMoods,
  PaperBackground,
  PolaroidFrame,
  Stamp,
  Sticker,
  StickyNote,
  WashiTape,
  washiPatterns
} from "../../src/shared/ui/art";
import { HardShadow } from "../../src/shared/ui/primitives/hard-shadow";
import { useTheme } from "../../src/shared/ui/providers/theme-provider";
import type { PastelName } from "../../src/shared/ui/tokens/primitives/color";

const PASTELS: PastelName[] = ["fresa", "menta", "lavanda", "limonada", "cielo", "melocoton", "tomate"];

/** Escaparate solo-dev de la capa de arte (/art). En producción redirige a la raíz. */
export default function ArtShowcaseRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <ArtShowcase />;
}

function useShowcaseFonts() {
  const [ready] = useFonts({
    "Rubik-Medium": require("../../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Bold": require("../../assets/fonts/Rubik-Bold.ttf"),
    "Rubik-ExtraBold": require("../../assets/fonts/Rubik-ExtraBold.ttf"),
    "Rubik-Black": require("../../assets/fonts/Rubik-Black.ttf")
  });
  return ready;
}

function ArtShowcase() {
  const params = useLocalSearchParams<{ only?: string; mood?: string; size?: string; color?: string }>();
  const fontsReady = useShowcaseFonts();

  if (!fontsReady) {
    return null;
  }

  // Modos lienzo para generar los PNG de icono/splash: una sola pieza sobre transparente.
  if (params.only === "logo") {
    return (
      <View style={styles.canvas}>
        <View testID="logo-canvas">
          <Logo height={Number(params.size ?? 400)} />
        </View>
      </View>
    );
  }

  if (params.only === "mochi") {
    return (
      <View style={styles.canvas}>
        <View testID="mochi-canvas">
          <Mascot
            size={Number(params.size ?? 1000)}
            mood={(params.mood as MascotMood) ?? "happy"}
            color={(params.color as PastelName) ?? "fresa"}
            animated={false}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PaperBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <LogoSection />
        <MochiSection />
        <IconSection />
        <StationerySection />
        <PolaroidSection />
        <BurstSection />
        <PaperSection />
      </ScrollView>
    </View>
  );
}

function LogoSection() {
  return (
    <Section title="Logo">
      <View style={styles.center}>
        <Logo height={72} testID="logo-hero" />
      </View>
      <View style={styles.row}>
        <Logo height={40} />
        <Logo height={28} />
        <Logo height={20} />
      </View>
      <View style={styles.row}>
        <Logo height={56} fill="fresa" />
        <Logo height={30} variant="plain" />
      </View>
    </Section>
  );
}

function MochiSection() {
  return (
    <Section title="Mascota">
      <View style={styles.center}>
        <Mascot size={200} mood="happy" accessibilityLabel="Mochi, la mascota de Cherry, sonriendo" testID="mochi-hero" />
      </View>
      <View style={styles.grid2}>
        {mascotMoods.map((mood) => (
          <View key={mood} style={styles.cell2} testID={`mochi-${mood}`}>
            <Mascot size={150} mood={mood} />
            <Caption>{mood}</Caption>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {PASTELS.map((tone) => (
          <Mascot key={tone} size={72} color={tone} mood="happy" animated={false} />
        ))}
      </View>
      <View style={[styles.row, styles.bottomAligned]}>
        {[32, 48, 64, 96].map((size) => (
          <Mascot key={size} size={size} mood="love" animated={false} />
        ))}
      </View>
    </Section>
  );
}

function IconSection() {
  const theme = useTheme();
  const c = theme.primitives.color;

  return (
    <Section title="Iconos">
      <View style={[styles.row, styles.bottomAligned]}>
        {[16, 20, 24, 32, 48].map((size) => (
          <View key={size} style={styles.sizeCell}>
            <Icon name="heart" size={size} />
            <Icon name="chat-dots" size={size} />
            <Icon name="cards" size={size} />
            <Caption>{size}</Caption>
          </View>
        ))}
      </View>
      <View style={styles.iconGrid}>
        {iconNames.map((name) => (
          <View key={name} style={styles.iconCell} testID={`icon-${name}`}>
            <Icon name={name} size={28} />
            <Caption>{name}</Caption>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <Icon name="heart" size={40} fill={c.fresa} />
        <Icon name="x" size={40} />
        <Icon name="undo" size={40} />
        <Icon name="star" size={40} fill={c.limonada} />
        <Icon name="sparkle" size={40} fill={c.lavanda} />
        <Icon name="user" size={40} fill={c.menta} />
        <Icon name="chat" size={40} fill={c.cielo} />
      </View>
    </Section>
  );
}

function StationerySection() {
  const theme = useTheme();

  return (
    <Section title="Papelería">
      <View style={styles.stack}>
        {washiPatterns.map((pattern, index) => (
          <WashiTape
            key={pattern}
            pattern={pattern}
            color={PASTELS[(index * 2) % PASTELS.length]}
            width={150 + index * 18}
            rotation={index % 2 === 0 ? -3 : 2}
          />
        ))}
      </View>

      <View style={[styles.row, styles.stampRow]}>
        <Stamp label="¡Me gusta!" tone="fresa" rotation={-12} />
        <Stamp label="Paso" tone="lavanda" rotation={10} />
      </View>
      <View style={[styles.row, styles.stampRow]}>
        <Stamp label="¡Match!" shape="circle" tone="fresa" rotation={-6} />
        <Stamp label="Nuevo" size="sm" rotation={4} />
        <Stamp label="Nuevo" size="sm" tone="menta" shape="circle" rotation={-4} />
      </View>

      <View style={[styles.row, styles.noteRow]}>
        <StickyNote tilt={-3} style={styles.note}>
          <Text style={[theme.primitives.text.hand, { color: theme.semantic.text.default }]}>
            Tomarte un respiro está bien.
          </Text>
        </StickyNote>
        <StickyNote color="menta" tilt={2.5} tape={{ color: "fresa", pattern: "hearts" }} style={styles.note}>
          <View style={styles.noteMochi}>
            <Mascot size={64} mood="sleepy" animated={false} />
          </View>
        </StickyNote>
      </View>

      <View style={[styles.row, styles.stickerRow]}>
        <Sticker color="limonada" shape="pill" rotation={-4}>
          <View style={styles.inline}>
            <Icon name="sparkle" size={16} />
            <Text style={[theme.primitives.text.label, { color: theme.semantic.text.default }]}>En común</Text>
          </View>
        </Sticker>
        <Sticker color="fresa" shape="circle" rotation={6} padding={10}>
          <Icon name="heart" size={28} fill={theme.primitives.color.white} />
        </Sticker>
        <Sticker rotation={3} elevation="md">
          <Text style={[theme.primitives.text.title3, { color: theme.semantic.text.default }]}>Lucía, 29</Text>
        </Sticker>
      </View>

      <View style={styles.row}>
        {decoKinds.map((kind, index) => (
          <Deco key={kind} kind={kind} size={34} color={PASTELS[index % PASTELS.length]} rotation={index % 2 === 0 ? -8 : 8} />
        ))}
      </View>
    </Section>
  );
}

function PolaroidSection() {
  return (
    <Section title="Polaroid">
      <View style={[styles.row, styles.polaroidRow]}>
        <PolaroidFrame width={170} tilt={-3} caption="¡hola!">
          <View style={styles.polaroidInner}>
            <PaperBackground tone="cielo" />
            <Mascot size={110} mood="wink" animated={false} />
          </View>
        </PolaroidFrame>
        <PolaroidFrame width={150} tilt={4} tapes="top" tapeColors={["limonada"]} tapePattern="grid" />
      </View>
    </Section>
  );
}

function BurstSection() {
  const theme = useTheme();
  const burst = useRef<HeartBurstHandle>(null);
  const slow = useRef<HeartBurstHandle>(null);
  const [confettiKey, setConfettiKey] = useState(0);

  return (
    <Section title="Celebración">
      <View style={[styles.burstStage, { borderColor: theme.primitives.color.ink }]}>
        <PaperBackground tone="fresa" />
        <Mascot size={96} mood="celebrate" />
        <HeartBurst ref={burst} />
        <HeartBurst ref={slow} duration={5200} />
        <Confetti trigger={confettiKey} origin={{ x: 175, y: 230 }} />
      </View>
      <View style={styles.row}>
        <DemoButton label="¡Corazones!" testID="burst-fire" onPress={() => burst.current?.fire()} />
        <DemoButton label="Cámara lenta" testID="burst-slow" onPress={() => slow.current?.fire()} />
        <DemoButton label="Confeti" testID="confetti-fire" onPress={() => setConfettiKey((k) => k + 1)} />
      </View>
    </Section>
  );
}

function PaperSection() {
  const theme = useTheme();

  return (
    <Section title="Papel">
      <View style={styles.row}>
        {PASTELS.map((tone) => (
          <View key={tone} style={[styles.paperSwatch, { borderColor: theme.primitives.color.ink }]}>
            <PaperBackground tone={tone} />
            <Caption>{tone}</Caption>
          </View>
        ))}
      </View>
    </Section>
  );
}

function DemoButton({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const theme = useTheme();

  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <HardShadow
          elevation={pressed ? "none" : "sm"}
          style={[
            styles.button,
            {
              backgroundColor: theme.primitives.color.limonada,
              borderColor: theme.primitives.color.ink,
              borderWidth: theme.primitives.border.regular
            },
            pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] }
          ]}
        >
          <Text style={[theme.primitives.text.buttonSmall, { color: theme.semantic.text.default }]}>{label}</Text>
        </HardShadow>
      )}
    </Pressable>
  );
}

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[theme.primitives.text.title2, { color: theme.semantic.text.default }]}>{title}</Text>
      {children}
    </View>
  );
}

function Caption({ children }: PropsWithChildren) {
  const theme = useTheme();

  return (
    <Text numberOfLines={1} style={[theme.primitives.text.caption, styles.caption, { color: theme.semantic.text.muted }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvas: { flex: 1, alignItems: "flex-start", justifyContent: "flex-start", backgroundColor: "transparent" },
  content: { padding: 20, gap: 36, paddingBottom: 96 },
  section: { gap: 18 },
  center: { alignItems: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  bottomAligned: { alignItems: "flex-end" },
  stack: { gap: 14, alignItems: "flex-start" },
  grid2: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  cell2: { width: "50%", alignItems: "center", gap: 2 },
  sizeCell: { alignItems: "center", gap: 6 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  iconCell: { width: "25%", alignItems: "center", gap: 4 },
  caption: { fontSize: 11, lineHeight: 14 },
  stampRow: { columnGap: 28, rowGap: 36, paddingVertical: 14 },
  noteRow: { alignItems: "flex-start", gap: 18, paddingTop: 10 },
  note: { width: 158 },
  noteMochi: { alignItems: "center", paddingVertical: 4 },
  stickerRow: { gap: 18, paddingVertical: 6 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  polaroidRow: { gap: 24, alignItems: "flex-start", paddingTop: 12 },
  polaroidInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  burstStage: {
    height: 300,
    borderRadius: 22,
    borderWidth: 2.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  button: { paddingHorizontal: 16, minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  paperSwatch: { width: 100, height: 90, borderRadius: 16, borderWidth: 2.5, overflow: "hidden", justifyContent: "flex-end", padding: 8 }
});
