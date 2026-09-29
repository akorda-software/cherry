/**
 * Gramática de movimiento de la libreta: las pegatinas se despegan y se pegan
 * (pop con rebote), los sellos caen de golpe, el papel se desliza y asienta.
 * Con «reducir movimiento» se sustituye todo por fundidos cortos.
 */
export const primitiveMotionTokens = {
  quick: 120,
  calm: 220,
  slow: 360,
  celebrate: 900,
  spring: {
    /** Pegatinas, sellos, chips al seleccionarse. */
    pop: { damping: 12, stiffness: 260, mass: 0.9 },
    /** Tarjetas y hojas que se asientan. */
    soft: { damping: 18, stiffness: 180, mass: 1 },
    /** Botones: pulsar y soltar. */
    snappy: { damping: 22, stiffness: 420, mass: 0.8 },
    /** Mascota y celebraciones. */
    wobbly: { damping: 8, stiffness: 200, mass: 1 }
  },
  /** Curvas cúbicas (x1, y1, x2, y2) para Easing.bezier. */
  easing: {
    outQuint: [0.22, 1, 0.36, 1],
    outBack: [0.34, 1.56, 0.64, 1],
    inOut: [0.65, 0, 0.35, 1]
  }
} as const;
