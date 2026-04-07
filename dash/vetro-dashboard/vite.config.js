import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    react(),
    legacy({
      // alvo mais conservador para TVs / webOS antigos
      targets: [
        "Chrome >= 49",
        "Safari >= 10",
        "iOS >= 10",
        "Android >= 5",
      ],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      modernPolyfills: true,
    }),
  ],
  build: {
    // evita ES muito novo
    target: "es2015",
    // pode deixar terser ou esbuild (ver abaixo)
    // minify: "esbuild",
  },
});
