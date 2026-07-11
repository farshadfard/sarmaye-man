import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_NATIVE_ANDROID": JSON.stringify("1"),
  },
  publicDir: "../public",
  root: "android-web",
  build: {
    emptyOutDir: true,
    outDir: "../dist-android",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
