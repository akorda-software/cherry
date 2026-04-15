import type { PropsWithChildren } from "react";

import { Card } from "../composites/card";
import { Screen } from "../primitives/screen";

export function PlaceholderScreen({
  testId,
  title,
  description,
  children
}: PropsWithChildren<{ testId: string; title: string; description: string }>) {
  return (
    <Screen testId={testId}>
      <Card description={description} title={title}>
        {children}
      </Card>
    </Screen>
  );
}
