import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000", // <-- Ensure this matches your Express backend port
        changeOrigin: true,
        secure: false,
        timeout: 300000,
        proxyTimeout: 300000,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            const code = (err as any).code;
            if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT") {
              const serverRes = res as any;
              if (serverRes && typeof serverRes.writeHead === "function" && !serverRes.headersSent) {
                serverRes.writeHead(503, { "Content-Type": "application/json" });
                serverRes.end(JSON.stringify({ error: "Backend server is restarting or offline on 127.0.0.1:3000", code: "BACKEND_OFFLINE" }));
              }
            }
          });
        },
      },
    },
  },
});
