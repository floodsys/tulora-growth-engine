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
        server.middlewares.use('/api', async (req, res, next) => {
          const url = req.url || '';
          
          try {
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

            // Route handlers
            if (url === '/admin/validate' && req.method === 'GET') {
              const { default: handler } = await import('./src/api/admin/validate');
              return handler(req, res);
            }
            
            if (url === '/admin/step-up/test' && req.method === 'POST') {
              const { default: handler } = await import('./src/api/admin/step-up/test');
              return handler(req, res);
            }

            // API not found
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'API endpoint not found' }));
            
          } catch (error) {
            console.error('API middleware error:', error);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
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