import type { ReactElement } from "react";

import { Icon, type IconName } from "../art";

/** Un icono del set (`"heart"`) o un nodo ya construido. */
export type IconSource = IconName | ReactElement;

export interface IconSlotProps {
  icon?: IconSource | null;
  size: number;
  color: string;
  fill?: string;
}

/** Pinta un `IconSource`: los nombres pasan por el `Icon` del sistema. */
export function IconSlot({ icon, size, color, fill }: IconSlotProps) {
  if (icon === undefined || icon === null) {
    return null;
  }

  if (typeof icon === "string") {
    return <Icon color={color} fill={fill} name={icon} size={size} />;
  }

  return icon;
}
