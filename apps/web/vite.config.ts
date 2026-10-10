import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["*.svg", "*.png"],
      manifest: {
        id: "/",
        name: "Chega de Briga",
        short_name: "Chega de Briga",
        description: "Combinados mais claros para quem divide a casa.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f7f9ff",
        theme_color: "#2447e8",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,png,ttf,otf}"],
        navigateFallback: "/index.html"
      }
    })
  ],
  publicDir: fileURLToPath(new URL("../../design-system/assets/", import.meta.url)),
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"]
  }
});
