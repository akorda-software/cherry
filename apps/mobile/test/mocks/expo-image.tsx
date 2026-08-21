import { Text } from "react-native";

interface ImageSource {
  uri?: unknown;
}

export function Image({ source }: { source?: ImageSource | number | null }) {
  const uri = source && typeof source === "object" && source !== null ? source.uri : null;

  return <Text testID="expo-image">{uri === null ? "" : String(uri)}</Text>;
}
