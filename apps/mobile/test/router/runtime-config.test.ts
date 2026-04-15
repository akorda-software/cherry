import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const mobileDir = path.resolve(__dirname, "../..");

async function readJson(relativePath: string) {
  const file = await readFile(path.join(mobileDir, relativePath), "utf8");
  return JSON.parse(file) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    compilerOptions?: { paths?: Record<string, string[]> };
  };
}

describe("mobile runtime config", () => {
  it("declares the Expo Router and React Navigation runtime dependencies", async () => {
    const packageJson = await readJson("package.json");

    expect(packageJson.dependencies).toMatchObject({
      expo: expect.any(String),
      "expo-router": expect.any(String),
      "react-native": expect.any(String),
      "react-native-web": expect.any(String),
      "@react-navigation/native": expect.any(String),
      "@react-navigation/drawer": expect.any(String),
      "@react-navigation/bottom-tabs": expect.any(String),
      "react-native-safe-area-context": expect.any(String),
      "react-native-screens": expect.any(String),
      "react-native-gesture-handler": expect.any(String),
      "react-native-reanimated": expect.any(String),
      "react-native-worklets": expect.any(String)
    });
    expect(packageJson.dependencies?.["react-native-worklets"]).toMatch(/^0\.5\./);
  });

  it("stops aliasing expo-router to the local test shim", async () => {
    const [tsconfig, vitestConfig] = await Promise.all([
      readJson("tsconfig.json"),
      readFile(path.join(mobileDir, "vitest.config.ts"), "utf8")
    ]);

    expect(tsconfig.compilerOptions?.paths?.["expo-router"]).toBeUndefined();
    expect(vitestConfig).not.toContain("./src/shared/router/expo-router.tsx");
    expect(vitestConfig).not.toContain('"expo-router":');
  });
});
