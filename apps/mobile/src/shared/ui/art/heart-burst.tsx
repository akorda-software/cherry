import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { HEART, SPARKLE, STAR } from "./icon-paths";
import { absoluteFill } from "./layout";

export type BurstShape = "heart" | "star" | "sparkle" | "circle";

export interface BurstOrigin {
  x: number;
  y: number;
}

export interface HeartBurstHandle {
  /** Dispara la celebración (opcionalmente desde otro punto del contenedor). */
  fire(origin?: BurstOrigin): void;
}

export interface HeartBurstProps {
  /** Cada cambio de valor (tras el montaje) dispara una celebración. */
  trigger?: unknown;
  /** Dispara una vez al montarse. */
  autoPlay?: boolean;
  /** Punto de salida en puntos dentro del contenedor (def. centro). */
  origin?: BurstOrigin;
  /** Número de partículas (def. 18, máx. 24). */
  count?: number;
  shapes?: BurstShape[];
  colors?: PastelName[];
  /** Tamaño base de cada partícula en puntos (def. 22). */
  particleSize?: number;
  /** Dirección central en grados (-90 = hacia arriba) y apertura del abanico. */
  direction?: number;
  spread?: number;
  /** Fuerza del estallido (def. 1). */
  power?: number;
  /** Duración total en ms (def. `motion.celebrate`, 900). */
  duration?: number;
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface BurstParticle {
  key: number;
  shape: BurstShape;
  color: string;
  size: number;
  vx: number;
  vy: number;
  spin: number;
  rotate0: number;
  delay: number;
}

interface Burst {
  id: number;
  origin: BurstOrigin;
  particles: BurstParticle[];
}

export const MAX_BURST_PARTICLES = 24;
const MAX_PARTICLES = MAX_BURST_PARTICLES;
const GRAVITY = 1100;
const DEFAULT_COLORS: PastelName[] = ["fresa", "limonada", "menta", "lavanda", "cielo", "melocoton"];
const DEFAULT_SHAPES: BurstShape[] = ["heart", "heart", "heart", "star", "sparkle", "circle"];

/**
 * Genera las partículas de un estallido (función pura, `random` inyectable).
 * Reparto uniforme en el abanico con un poco de azar: nada de huecos raros.
 */
export function createBurstParticles(
  options: {
    count: number;
    shapes: BurstShape[];
    colors: string[];
    particleSize: number;
    direction: number;
    spread: number;
    power: number;
    salt?: number;
  },
  random: () => number = Math.random
): BurstParticle[] {
  const { shapes, colors, particleSize, direction, spread, power, salt = 0 } = options;
  const n = Math.min(Math.max(Math.round(options.count), 1), MAX_PARTICLES);
  const particles: BurstParticle[] = [];
  for (let i = 0; i < n; i++) {
    const slot = n === 1 ? 0.5 : i / (n - 1);
    const base = spread >= 360 ? slot * 360 : (slot - 0.5) * spread;
    const angle = ((direction + base + (random() - 0.5) * (spread / n) * 0.8) * Math.PI) / 180;
    const speed = (240 + random() * 420) * power;
    particles.push({
      key: i,
      shape: shapes[i % shapes.length],
      color: colors[(i * 7 + salt) % colors.length],
      size: particleSize * (0.7 + random() * 0.55),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 120 * power,
      spin: (random() - 0.5) * 540,
      rotate0: (random() - 0.5) * 50,
      delay: random() * 0.06
    });
  }
  return particles;
}

/**
 * Celebración de partículas pastel con contorno de tinta (corazones, estrellas,
 * destellos y círculos) que estallan desde un punto con gravedad y giro.
 * Todo corre en el hilo de UI con una única línea de tiempo por estallido. Con
 * «reducir movimiento» se sustituye por un destello que aparece y se apaga.
 * Colócalo como capa sobre el contenido; nunca captura toques.
 */
export const HeartBurst = memo(
  forwardRef<HeartBurstHandle, HeartBurstProps>(function HeartBurst(
    {
      trigger,
      autoPlay = false,
      origin,
      count = 18,
      shapes = DEFAULT_SHAPES,
      colors = DEFAULT_COLORS,
      particleSize = 22,
      direction = -90,
      spread = 360,
      power = 1,
      duration,
      onDone,
      style,
      testID
    },
    ref
  ) {
    const theme = useTheme();
    const reducedMotion = useReducedMotion();
    const total = duration ?? theme.primitives.motion.celebrate;
    const [size, setSize] = useState<{ width: number; height: number } | null>(null);
    const [burst, setBurst] = useState<Burst | null>(null);
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const burstId = useRef(0);
    const pendingAutoPlay = useRef(autoPlay);

    const fire = useCallback(
      (at?: BurstOrigin) => {
        const box = sizeRef.current;
        const point = at ?? origin ?? (box ? { x: box.width / 2, y: box.height / 2 } : { x: 0, y: 0 });
        burstId.current += 1;
        const particles = createBurstParticles({
          count,
          shapes,
          colors: colors.map((name) => theme.primitives.pastel[name].fill),
          particleSize,
          direction,
          spread,
          power,
          salt: burstId.current
        });
        setBurst({ id: burstId.current, origin: point, particles });
      },
      [colors, count, direction, origin, particleSize, power, shapes, spread, theme.primitives.pastel]
    );

    useImperativeHandle(ref, () => ({ fire }), [fire]);

    const firstTrigger = useRef(true);
    useEffect(() => {
      if (firstTrigger.current) {
        firstTrigger.current = false;
        return;
      }
      if (trigger !== undefined && trigger !== null && trigger !== false) {
        fire();
      }
      // Solo reaccionamos a cambios de `trigger`.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger]);

    const onLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setSize({ width, height });
      sizeRef.current = { width, height };
      if (pendingAutoPlay.current) {
        pendingAutoPlay.current = false;
        fire();
      }
    };

    const handleDone = useCallback(
      (id: number) => {
        setBurst((current) => (current && current.id === id ? null : current));
        onDone?.();
      },
      [onDone]
    );

    return (
      <View testID={testID} aria-hidden onLayout={onLayout} style={[absoluteFill, { pointerEvents: "none" }, style]}>
        {burst ? (
          reducedMotion ? (
            <GentleSparkle key={burst.id} id={burst.id} origin={burst.origin} onDone={handleDone} />
          ) : (
            <BurstLayer key={burst.id} burst={burst} duration={total} onDone={handleDone} />
          )
        ) : null}
      </View>
    );
  })
);

/** Confeti: la misma física en fuente hacia arriba, con más variedad de formas. */
export const Confetti = forwardRef<HeartBurstHandle, HeartBurstProps>(function Confetti(props, ref) {
  return (
    <HeartBurst
      ref={ref}
      count={24}
      shapes={["circle", "star", "sparkle", "heart", "circle", "sparkle"]}
      direction={-90}
      spread={110}
      power={1.25}
      {...props}
    />
  );
});

function BurstLayer({ burst, duration, onDone }: { burst: Burst; duration: number; onDone: (id: number) => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) {
        runOnJS(onDone)(burst.id);
      }
    });
  }, [burst.id, duration, onDone, progress]);

  return (
    <>
      {burst.particles.map((particle) => (
        <ParticleView key={particle.key} particle={particle} origin={burst.origin} progress={progress} seconds={duration / 1000} />
      ))}
    </>
  );
}

const ParticleView = memo(function ParticleView({
  particle,
  origin,
  progress,
  seconds
}: {
  particle: BurstParticle;
  origin: BurstOrigin;
  progress: SharedValue<number>;
  seconds: number;
}) {
  const theme = useTheme();
  const { size } = particle;

  const style = useAnimatedStyle(() => {
    const p = Math.max(0, progress.value - particle.delay) / (1 - particle.delay);
    const t = p * seconds;
    // Un poco de rozamiento: la partícula frena al alejarse.
    const drag = 1 - 0.28 * p;
    const x = particle.vx * t * drag;
    const y = particle.vy * t * drag + 0.5 * GRAVITY * t * t;
    // Pop inicial (0.55 → 1.12 → 1) y encogerse al final.
    const pop = p < 0.12 ? 0.55 + (p / 0.12) * 0.57 : p < 0.22 ? 1.12 - ((p - 0.12) / 0.1) * 0.12 : 1 - Math.max(0, p - 0.6) * 0.9;
    const opacity = p <= 0 ? 0 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${particle.rotate0 + particle.spin * t}deg` },
        { scale: pop }
      ]
    };
  });

  const ink = theme.primitives.color.ink;
  const strokeWidth = (2 * 24) / size;

  return (
    <Animated.View
      style={[
        { position: "absolute", left: origin.x - size / 2, top: origin.y - size / 2, width: size, height: size },
        style
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {particle.shape === "circle" ? (
          <Circle cx={12} cy={12} r={7} fill={particle.color} stroke={ink} strokeWidth={strokeWidth} />
        ) : (
          <Path
            d={particle.shape === "heart" ? HEART : particle.shape === "star" ? STAR : SPARKLE}
            fill={particle.color}
            stroke={ink}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </Animated.View>
  );
});

function GentleSparkle({ id, origin, onDone }: { id: number; origin: BurstOrigin; onDone: (id: number) => void }) {
  const theme = useTheme();
  const opacity = useSharedValue(0);
  const size = 44;

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 140 }),
      withTiming(0, { duration: 420 }, (finished) => {
        if (finished) {
          runOnJS(onDone)(id);
        }
      })
    );
  }, [id, onDone, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ position: "absolute", left: origin.x - size / 2, top: origin.y - size / 2 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={SPARKLE}
          fill={theme.primitives.color.limonada}
          stroke={theme.primitives.color.ink}
          strokeWidth={(2.4 * 24) / size}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}
