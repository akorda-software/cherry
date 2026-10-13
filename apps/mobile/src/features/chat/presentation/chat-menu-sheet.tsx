import { ListRow, ListSection, Sheet } from "../../../shared/ui";

export interface ChatMenuSheetProps {
  visible: boolean;
  name: string;
  onClose(): void;
  onViewProfile(): void;
  onUnmatch(): void;
  onSafety(): void;
}

/** Menú ⋯ de la conversación: ver perfil, deshacer match, reportar o bloquear. */
export function ChatMenuSheet({ visible, name, onClose, onViewProfile, onUnmatch, onSafety }: ChatMenuSheetProps) {
  return (
    <Sheet onClose={onClose} scroll={false} testID="chat-menu-sheet" title={name} visible={visible}>
      <ListSection>
        <ListRow icon="user" iconColor="cielo" label="Ver perfil" onPress={onViewProfile} testID="chat-menu-profile" />
        <ListRow
          description="El chat se cerrará para los dos."
          icon="heart-crack"
          iconColor="lavanda"
          label="Deshacer match"
          onPress={onUnmatch}
          testID="chat-menu-unmatch"
        />
        <ListRow danger icon="flag" label="Reportar o bloquear" onPress={onSafety} testID="chat-menu-safety" />
      </ListSection>
    </Sheet>
  );
}
