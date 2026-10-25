import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "E39 Garage",
        short_name: "E39 Garage",
        description: "Deine E39 Tuning-Garage. Teile wählen und direkt am Wagen ausprobieren.",
        theme_color: "#11161c",
        background_color: "#11161c",
        display: "standalone",
        start_url: "/",
        lang: "de",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["**/models/**"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /\/models\/environments\/.*\.hdr$/,
            handler: "CacheFirst",
            options: {
              cacheName: "e39-environments-v1",
              expiration: { maxEntries: 2, maxAgeSeconds: 2592000 },
            },
          },
          {
            urlPattern: /\/models\/.*\.glb$/,
            handler: "CacheFirst",
            options: {
              cacheName: "e39-models-v1",
              expiration: { maxEntries: 3, maxAgeSeconds: 2592000 },
            },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    host: "127.0.0.1",
    port: 5268,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url)), realpathSync(fileURLToPath(new URL("./node_modules", import.meta.url)))] },
    proxy: { "/api/parts": "http://127.0.0.1:5191" },
  },
});
