import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../shared/ui";

interface SaveButtonProps {
  saving: boolean;
  savedAt: number | null;
  onPress(): void;
  testID?: string;
  label?: string;
  savedLabel?: string;
  savingLabel?: string;
  durationMs?: number;
}

export function SaveButton({
  saving,
  savedAt,
  onPress,
  testID,
  label = "Guardar",
  savedLabel = "✓ Guardado",
  savingLabel = "Guardando…",
  durationMs = 2200
}: SaveButtonProps) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (savedAt === null) {
      setShowSaved(false);
      return;
    }
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), durationMs);
    return () => clearTimeout(t);
  }, [savedAt, durationMs]);

  const text = useMemo(() => {
    if (saving) return savingLabel;
    if (showSaved) return savedLabel;
    return label;
  }, [label, saving, savedLabel, savingLabel, showSaved]);

  return (
    <Button testID={testID} disabled={saving} onPress={onPress}>
      {text}
    </Button>
  );
}
