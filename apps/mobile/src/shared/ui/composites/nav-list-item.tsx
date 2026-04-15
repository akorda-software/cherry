import { Button } from "../primitives/button";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";

interface NavListItemProps {
  label: string;
  description?: string;
  selected?: boolean;
  onPress(): void;
}

export function NavListItem({ description, label, onPress, selected = false }: NavListItemProps) {
  return (
    <Stack>
      <Button aria-current={selected ? "page" : undefined} onPress={onPress}>
        {label}
      </Button>
      {description ? <Text>{description}</Text> : null}
    </Stack>
  );
}
