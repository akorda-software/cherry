/**
 * Neobrutalism elevation: hard offset shadows (no blur) over the ink color.
 * Spread these into a view style. iOS renders them truly hard; Android falls
 * back to a soft elevation shadow while the bold border carries the look.
 */
export const primitiveElevationTokens = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  sm: {
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4
  },
  md: {
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6
  },
  lg: {
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8
  }
} as const;
