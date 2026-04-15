import { Slot } from "expo-router";

// Tab UI is owned by ShellScaffold, which renders the tab bar for every route
// under (tabs) using the shared design system. This layout just forwards the
// nested route via Slot so the (tabs) group exists for URL purposes.
export default function TabsLayoutRoute() {
  return <Slot />;
}
