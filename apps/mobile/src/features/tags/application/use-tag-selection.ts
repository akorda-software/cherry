import { useCallback, useMemo, useState } from "react";

export type TagSelectionState = "neutral" | "liked" | "blocked";

export const MAX_POSITIVE_TAGS = 8;
export const MAX_BLOCKED_TAGS = 5;

export interface UseTagSelectionOptions {
  initialPositiveIds?: string[];
  initialBlockedIds?: string[];
  maxPositive?: number;
  maxBlocked?: number;
}

export interface UseTagSelectionResult {
  positiveIds: string[];
  blockedIds: string[];
  stateOf(tagId: string): TagSelectionState;
  toggleLike(tagId: string): void;
  toggleBlock(tagId: string): void;
  positiveCount: number;
  blockedCount: number;
  maxPositive: number;
  maxBlocked: number;
  positiveFull: boolean;
  blockedFull: boolean;
  reset(selection: { positive?: string[]; blocked?: string[] }): void;
}

export function useTagSelection({
  initialPositiveIds = [],
  initialBlockedIds = [],
  maxPositive = MAX_POSITIVE_TAGS,
  maxBlocked = MAX_BLOCKED_TAGS
}: UseTagSelectionOptions = {}): UseTagSelectionResult {
  const [positiveIds, setPositiveIds] = useState<string[]>(initialPositiveIds);
  const [blockedIds, setBlockedIds] = useState<string[]>(initialBlockedIds);

  const positiveSet = useMemo(() => new Set(positiveIds), [positiveIds]);
  const blockedSet = useMemo(() => new Set(blockedIds), [blockedIds]);

  const stateOf = useCallback(
    (tagId: string): TagSelectionState => {
      if (positiveSet.has(tagId)) {
        return "liked";
      }

      if (blockedSet.has(tagId)) {
        return "blocked";
      }

      return "neutral";
    },
    [blockedSet, positiveSet]
  );

  const toggleLike = useCallback(
    (tagId: string) => {
      setPositiveIds((prev) => {
        if (prev.includes(tagId)) {
          return prev.filter((id) => id !== tagId);
        }

        if (prev.length >= maxPositive) {
          return prev;
        }

        return [...prev, tagId];
      });
      setBlockedIds((prev) => prev.filter((id) => id !== tagId));
    },
    [maxPositive]
  );

  const toggleBlock = useCallback(
    (tagId: string) => {
      setBlockedIds((prev) => {
        if (prev.includes(tagId)) {
          return prev.filter((id) => id !== tagId);
        }

        if (prev.length >= maxBlocked) {
          return prev;
        }

        return [...prev, tagId];
      });
      setPositiveIds((prev) => prev.filter((id) => id !== tagId));
    },
    [maxBlocked]
  );

  const reset = useCallback(
    ({ positive, blocked }: { positive?: string[]; blocked?: string[] }) => {
      if (positive !== undefined) {
        setPositiveIds(positive);
      }

      if (blocked !== undefined) {
        setBlockedIds(blocked);
      }
    },
    []
  );

  return {
    positiveIds,
    blockedIds,
    stateOf,
    toggleLike,
    toggleBlock,
    positiveCount: positiveIds.length,
    blockedCount: blockedIds.length,
    maxPositive,
    maxBlocked,
    positiveFull: positiveIds.length >= maxPositive,
    blockedFull: blockedIds.length >= maxBlocked,
    reset
  };
}
