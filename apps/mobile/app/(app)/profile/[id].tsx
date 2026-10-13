import { useLocalSearchParams } from "expo-router";

import { FullProfileScreen } from "../../../src/features/discovery";

export default function ProfileDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <FullProfileScreen profileId={String(id ?? "")} />;
}
