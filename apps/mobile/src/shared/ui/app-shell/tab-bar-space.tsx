import { createContext, useContext } from "react";

/**
 * Espacio (px) que ocupa la barra de pestañas flotante sobre el borde inferior
 * (barra + margen + safe area). Lo provee el layout de pestañas; fuera de las
 * pestañas vale 0. `Screen` lo usa para que nada quede tapado.
 */
export const TabBarSpaceContext = createContext(0);

export function useTabBarSpace() {
  return useContext(TabBarSpaceContext);
}
