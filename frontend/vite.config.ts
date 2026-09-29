import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:18090",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;

          // React core
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-react";
          }

          // Charts (recharts + d3 зависимости)
          if (
            /[\\/]node_modules[\\/](recharts|d3-|victory-|internmap)/.test(id)
          ) {
            return "vendor-charts";
          }

          // Data fetching
          if (
            /[\\/]node_modules[\\/](@tanstack|zustand)[\\/]/.test(id)
          ) {
            return "vendor-query";
          }

          // Forms
          if (
            /[\\/]node_modules[\\/](react-hook-form|zod|@hookform)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-forms";
          }

          // UI-утилиты
          if (
            /[\\/]node_modules[\\/](lucide-react|clsx|tailwind-merge|class-variance-authority|date-fns|sonner|cmdk)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-ui";
          }

          // Radix UI
          if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) {
            return "vendor-radix";
          }
        },
      },
    },
  },
});