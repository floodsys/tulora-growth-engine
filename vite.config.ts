/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { ViteDevServer } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Generate build info at build time
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(
      process.env.GITHUB_SHA?.substring(0, 12) || 
      process.env.VITE_COMMIT_SHA || 
      'unknown'
    ),
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(
      process.env.VITE_BUILD_ID || 
      `${process.env.GITHUB_SHA?.substring(0, 12) || 'build'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    ),
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(
      process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString()
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  preview: {
    headers: {
      'X-Commit-SHA': process.env.GITHUB_SHA?.substring(0, 12) || process.env.VITE_COMMIT_SHA || 'unknown',
      'X-Build-Id': process.env.VITE_BUILD_ID || `${process.env.GITHUB_SHA?.substring(0, 12) || 'build'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  },
  plugins: [
    // API middleware plugin - MUST be first to prevent SPA fallback
    {
      name: 'api-middleware',
      configureServer(server: ViteDevServer) {
        // Add middleware at the very beginning, before any other middleware
        server.middlewares.use((req, res, next) => {
          // Inject version headers on all HTML responses
          const commitSha = process.env.GITHUB_SHA?.substring(0, 12) || process.env.VITE_COMMIT_SHA || 'unknown';
          const buildId = process.env.VITE_BUILD_ID || `${commitSha}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          res.setHeader('X-Commit-SHA', commitSha);
          res.setHeader('X-Build-Id', buildId);
          
          // Only handle /api/** routes for API functionality
          if (!req.url?.startsWith('/api/')) {
            return next();
          }

          console.log(`[API Middleware] Intercepted: ${req.method} ${req.url}`);
          
          const url = req.url.substring(4) || ''; // Remove '/api' prefix
          
          // Set strict no-cache headers for all API routes
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
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
            console.log('[API Middleware] Handling ping endpoint');
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

          // Handle healthz endpoint
          if (url === '/healthz' && req.method === 'GET') {
            console.log('[API Middleware] Handling healthz endpoint');
            import('./src/api/healthz.js').then(({ default: handler }) => {
              handler(req, res);
            }).catch(error => {
              console.error('Error loading healthz handler:', error);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Health endpoint loading failed' }));
            });
            return;
          }

          // Handle validate endpoint
          if (url === '/admin/validate' && req.method === 'GET') {
            console.log('[API Middleware] Handling validate endpoint');
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
            console.log('[API Middleware] Handling step-up test endpoint');
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

          // API route not found - return 404 JSON, preventing SPA fallback
          console.log(`[API Middleware] Unknown API route: ${req.url}`);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'API endpoint not found', path: req.url }));
        });
      }
    },
    // Generate version.json at build time
    {
      name: 'generate-version-file',
      generateBundle(this: any) {
        const commitSha = process.env.GITHUB_SHA?.substring(0, 12) || 
                         process.env.VITE_COMMIT_SHA || 
                         'unknown';
        const buildId = process.env.VITE_BUILD_ID || 
                       `${commitSha}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const buildTimestamp = process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString();
        
        const versionInfo = {
          commit: commitSha,
          buildId,
          buildTimestamp,
          ...(process.env.NODE_ENV && { env: process.env.NODE_ENV })
        };

        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(versionInfo, null, 2)
        });
      }
    },
    react(),
    mode === 'development' &&
    componentTagger(),
    // Sentry plugin for production builds with source maps
    process.env.VITE_ENABLE_SENTRY === 'true' && process.env.SENTRY_AUTH_TOKEN && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      
      // Upload source maps only in production
      sourcemaps: {
        assets: ['./dist/assets/**'],
        ignore: ['node_modules/**'],
      },
      
      // Set release name to match our format: repo@shortSHA
      release: {
        name: `${process.env.VITE_REPO_NAME || 'unknown-repo'}@${(process.env.VITE_COMMIT_SHA || 'unknown').substring(0, 8)}`,
      },
    })
  ].filter(Boolean) as any,
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom']
        }
      }
    }
  },
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