import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.mock("react-native", async () => import("./mocks/react-native"));
vi.mock("expo-router", async () => import("./mocks/expo-router"));
vi.mock("expo-router/drawer", async () => import("./mocks/expo-router-drawer"));
vi.mock("@react-native-google-signin/google-signin", async () => import("./mocks/google-signin"));
vi.mock("expo-apple-authentication", async () => import("./mocks/expo-apple-authentication"));
vi.mock("expo-secure-store", async () => import("./mocks/expo-secure-store"));
vi.mock("expo-application", async () => import("./mocks/expo-application"));
vi.mock("expo-device", async () => import("./mocks/expo-device"));
vi.mock("expo-constants", async () => import("./mocks/expo-constants"));
vi.mock("expo-crypto", async () => import("./mocks/expo-crypto"));
vi.mock("@stripe/stripe-react-native", async () => import("./mocks/stripe-react-native"));
vi.mock("react-native-safe-area-context", async () =>
  import("./mocks/react-native-safe-area-context")
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
