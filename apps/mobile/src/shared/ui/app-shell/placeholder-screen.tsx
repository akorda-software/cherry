import type { PropsWithChildren } from "react";

import { TopBar } from "../composites/top-bar";
import { Screen } from "../primitives/screen";
import { Text } from "../primitives/text";

/** @deprecated usa `Screen` + `TopBar`. Pantalla sencilla con cabecera y texto. */
export function PlaceholderScreen({
  testId,
  title,
  description,
  children
}: PropsWithChildren<{ testId: string; title: string; description: string }>) {
  return (
    <Screen header={<TopBar left="back" title={title} />} scroll testID={testId}>
      {description ? <Text color="muted">{description}</Text> : null}
      {children}
    </Screen>
  );
}
