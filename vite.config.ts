import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
 
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['youtube-transcript'],
    exclude: ['pdfjs-dist/build/pdf.worker.entry'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfWorker: ['pdfjs-dist/build/pdf.worker.entry'],
        },
      },
      external: ['youtube-transcript']
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})