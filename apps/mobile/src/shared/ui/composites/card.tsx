import type { PropsWithChildren, ReactNode } from "react";

import { Heading } from "../primitives/heading";
import { Stack } from "../primitives/stack";
import { Surface, type SurfaceProps } from "../primitives/surface";
import { Text } from "../primitives/text";

export interface CardProps extends SurfaceProps {
  title?: string;
  description?: string;
  footer?: ReactNode;
}

/**
 * Tarjeta de libreta (radio 22, contorno 3, sombra dura). Con `title`,
 * `description` y `footer` compone un bloque de contenido; nunca anides tarjetas.
 */
export function Card({ children, title, description, footer, radius = "lg", padding = 20, ...props }: PropsWithChildren<CardProps>) {
  const composed = Boolean(title || description || footer);

  return (
    <Surface padding={padding} radius={radius} {...props}>
      {composed ? (
        <Stack gap="sm">
          {title ? <Heading level={3}>{title}</Heading> : null}
          {description ? <Text color="muted">{description}</Text> : null}
          {children ? <Stack style={title || description ? { marginTop: 8 } : null}>{children}</Stack> : null}
          {footer ? <Stack style={{ marginTop: 8 }}>{footer}</Stack> : null}
        </Stack>
      ) : (
        children
      )}
    </Surface>
  );
}
