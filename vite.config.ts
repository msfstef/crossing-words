import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // Allow custom base path via env for PR previews (e.g., /crossing-words/pr-preview/pr-123/)
  const base =
    process.env.VITE_BASE_PATH ||
    (command === "build" ? "/crossing-words/" : "/");

  return {
    base,
    server: {
      allowedHosts: ["ungloweringly-ramose-donita.ngrok-free.dev"],
    },
    preview: {
      allowedHosts: ["ungloweringly-ramose-donita.ngrok-free.dev"],
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              // Cache puzzle downloads from CORS proxy
              urlPattern:
                /^https:\/\/crossing-words-proxy\..*\.workers\.dev\/puzzle/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "puzzle-api-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              // Cache external puzzle sources (with fallback to cache)
              urlPattern: /^https:\/\/(www\.)?.*\.(puz|ipuz|jpz|json)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "puzzle-files-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
        },
        manifest: {
          name: "Crossing Words",
          short_name: "CrossingWords",
          description: "Cross-platform, peer-to-peer collaborative crossword app",
          theme_color: "#f8f6f3",
          background_color: "#f8f6f3",
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone"],
          start_url: base,
          scope: base,
          // Use "natural" to respect device's natural orientation and system settings
          // On phones this defaults to portrait; tablets may vary
          // This better respects Android system orientation lock settings
          orientation: "natural",
          categories: ["games", "entertainment", "education"],
          launch_handler: {
            client_mode: "focus-existing",
          },
          // Chrome 139+ feature for capturing in-scope links in installed PWA
          handle_links: "preferred",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
          shortcuts: [
            {
              name: "New Puzzle",
              short_name: "New",
              description: "Start a new crossword puzzle",
              url: `${base}?action=new`,
              icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
            },
          ],
        },
      }),
    ],
  };
});
