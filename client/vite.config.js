import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: { "/api": process.env.API_PROXY_TARGET || "http://127.0.0.1:3000" },
  },
});
