import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/ws": { target: "ws://127.0.0.1:8787", ws: true },
    },
    // Fallback routing for SPA: send /call/* routes to call.html
    middlewares: [
      {
        name: "spa-fallback",
        apply: "serve",
        handler(req, res, next) {
          // Match /call/ or /call/* but not /call.html
          if (req.url?.match(/^\/call\//) && !req.url.endsWith(".html")) {
            req.url = "/call.html";
          }
          next();
        },
      },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        call: resolve(__dirname, "call.html"),
        sessions: resolve(__dirname, "sessions.html"),
        sessionDetail: resolve(__dirname, "session-detail.html"),
      },
    },
  },
});
