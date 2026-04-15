import type { ReactNode } from "react";

import { Heading } from "../primitives/heading";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <Stack>
      <Heading>{title}</Heading>
      <Text>{description}</Text>
      {action}
    </Stack>
  );
}
