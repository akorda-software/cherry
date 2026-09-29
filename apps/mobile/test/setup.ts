import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

(globalThis as { __DEV__?: boolean }).__DEV__ = true;

vi.mock("react-native", async () => import("./mocks/react-native"));
vi.mock("react-native-svg", async () => import("./mocks/react-native-svg"));
vi.mock("expo-router", async () => import("./mocks/expo-router"));
vi.mock("expo-router/drawer", async () => import("./mocks/expo-router-drawer"));
vi.mock("@react-native-google-signin/google-signin", async () => import("./mocks/google-signin"));
vi.mock("expo-apple-authentication", async () => import("./mocks/expo-apple-authentication"));
vi.mock("expo-secure-store", async () => import("./mocks/expo-secure-store"));
vi.mock("expo-application", async () => import("./mocks/expo-application"));
vi.mock("expo-device", async () => import("./mocks/expo-device"));
vi.mock("expo-constants", async () => import("./mocks/expo-constants"));
vi.mock("expo-crypto", async () => import("./mocks/expo-crypto"));
vi.mock("expo-image", async () => import("./mocks/expo-image"));
vi.mock("@shopify/flash-list", async () => import("./mocks/flash-list"));
vi.mock("react-native-reanimated", async () => import("./mocks/react-native-reanimated"));
vi.mock("react-native-safe-area-context", async () =>
  import("./mocks/react-native-safe-area-context")
);

vi.mock("react-native-gesture-handler", async () => import("./mocks/react-native-gesture-handler"));
vi.mock("expo-haptics", async () => import("./mocks/expo-haptics"));
vi.mock("expo-linear-gradient", async () => import("./mocks/expo-linear-gradient"));
vi.mock("expo-font", async () => import("./mocks/expo-font"));
vi.mock("expo-splash-screen", async () => import("./mocks/expo-splash-screen"));
vi.mock("expo-status-bar", async () => import("./mocks/expo-status-bar"));
vi.mock("expo-system-ui", async () => import("./mocks/expo-system-ui"));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
