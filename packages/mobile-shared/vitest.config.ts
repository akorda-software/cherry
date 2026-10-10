import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@cherry/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts")
    }
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
