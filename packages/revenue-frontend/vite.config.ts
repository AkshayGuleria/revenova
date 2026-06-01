import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    fs: {
      // Allow serving files from monorepo root (required when running from a git worktree)
      allow: [path.resolve(__dirname, "../../../.."), __dirname],
    },
  },
});
