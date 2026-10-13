import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const landingBuild = mode === "landing";

  return {
    server: {
      proxy: {
        "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000",
      },
    },
    plugins: [
      react(),
      ...(landingBuild
        ? [{
            name: "landing-entry",
            transformIndexHtml: {
              order: "pre" as const,
              handler(html: string) {
                const appEntry = "/src/main.tsx";
                if (!html.includes(appEntry)) throw new Error("Landing build could not find the app HTML entry.");
                return html.replace(appEntry, "/src/landing-main.tsx");
              },
            },
          }]
        : []),
      ...(!landingBuild
        ? [VitePWA({
            strategies: "injectManifest",
            registerType: "prompt",
            srcDir: "src",
            filename: "sw.ts",
            injectRegister: "auto",
            includeAssets: ["*.svg", "*.png"],
            manifest: {
              id: "/",
              name: "Chega de Briga",
              short_name: "Chega de Briga",
              description: "Combinados mais claros para quem divide a casa.",
              lang: "pt-BR",
              start_url: "/casa",
              scope: "/",
              display: "standalone",
              background_color: "#f7f9ff",
              theme_color: "#2447e8",
              icons: [
                { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
                { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
                { src: "/pwa-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
                { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              ],
            },
            injectManifest: {
              globPatterns: ["**/*.{html,js,css,svg,png,jpg,ttf,otf}"],
            },
          })]
        : []),
    ],
    publicDir: fileURLToPath(new URL("../../design-system/assets/", import.meta.url)),
    ...(landingBuild ? { build: { outDir: "dist-landing" } } : {}),
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
    },
  };
});
