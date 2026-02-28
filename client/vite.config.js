import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Backend REST API proxy (Node.js server on port 5000)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Socket.io proxy
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
      // Python YOLO detector (optional - only if python_detector is running)
      '/detector': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  define: {
    // Ensures process.env isn't required in client code
    'process.env': {},
  },
});
