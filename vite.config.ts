/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteDevServer } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Generate BUILD_ID at build time
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(
      process.env.VITE_BUILD_ID || `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    // API middleware plugin
    {
      name: 'api-middleware',
      configureServer(server: ViteDevServer) {
        // Insert API middleware BEFORE other middlewares to ensure precedence
        server.middlewares.use('/api', (req, res, next) => {
          const url = req.url || '';
          
          // Set no-cache headers for all API routes
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Vary', 'Cookie, Authorization');
          res.setHeader('X-Server-Runtime', 'vite-middleware');
          
          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, cookie');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.statusCode = 200;
            res.end();
            return;
          }

          // Handle ping endpoint
          if (url === '/_ping' && req.method === 'GET') {
            import('./src/api/_ping.js').then(({ default: handler }) => {
              handler(req, res);
            }).catch(error => {
              console.error('Error loading ping handler:', error);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Ping handler loading failed' }));
            });
            return;
          }

          // Handle validate endpoint
          if (url === '/admin/validate' && req.method === 'GET') {
            import('./src/api/admin/validate.js').then(({ default: handler }) => {
              handler(req, res);
            }).catch(error => {
              console.error('Error loading validate handler:', error);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Handler loading failed' }));
            });
            return;
          }
          
          // Handle test endpoint
          if (url === '/admin/step-up/test' && req.method === 'POST') {
            import('./src/api/admin/step-up/test.js').then(({ default: handler }) => {
              handler(req, res);
            }).catch(error => {
              console.error('Error loading test handler:', error);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Handler loading failed' }));
            });
            return;
          }

          // API route not found - return 404 JSON instead of letting SPA handle it
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'API endpoint not found', path: url }));
        });
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
}));