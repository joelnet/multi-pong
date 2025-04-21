import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    host: '0.0.0.0', // Allow all hosts
    cors: true, // Enable CORS for all origins
    hmr: {
      host: 'localhost',
    },
    proxy: {
      // Handle WebSocket connections
      '/socket.io': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
    // Allow all hosts including ngrok domains
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok.app', // This will match any subdomain of ngrok.app
      '.ngrok.io', // For older ngrok domains
    ],
  },
});
