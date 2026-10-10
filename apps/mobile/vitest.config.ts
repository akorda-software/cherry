import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@cherry/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "@cherry/mobile-shared": path.resolve(__dirname, "../../packages/mobile-shared/src/index.ts")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"]
  }
});
