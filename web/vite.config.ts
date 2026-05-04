import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the backend so we don't have to deal with CORS
    // or hardcoded backend URLs in the frontend code.
    proxy: {
      "/chat": "http://localhost:3000",
      "/audit": "http://localhost:3000",
      "/metadata": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
    },
  },
});
