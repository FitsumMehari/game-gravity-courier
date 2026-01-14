import { defineConfig } from "vite";

/** GitHub Pages: /<repo-name>/ */
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  build: {
    chunkSizeWarningLimit: 900,
  },
});
