# HTTP Header Injection Examples

This project injects `X-Commit-SHA` and `X-Build-Id` headers on all responses for version tracking.

## Development
Headers are automatically injected via Vite middleware during development.

## Production Hosting

### Vercel (vercel.json)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Commit-SHA",
          "value": "$VERCEL_GIT_COMMIT_SHA"
        },
        {
          "key": "X-Build-Id", 
          "value": "$VERCEL_GIT_COMMIT_SHA-$VERCEL_DEPLOYMENT_ID"
        }
      ]
    }
  ]
}
```

### Netlify (_headers)
```
/*
  X-Commit-SHA: $COMMIT_REF
  X-Build-Id: $COMMIT_REF-$DEPLOY_ID
```

### Cloudflare Pages (_headers)
```
/*
  X-Commit-SHA: $CF_PAGES_COMMIT_SHA
  X-Build-Id: $CF_PAGES_COMMIT_SHA-$CF_PAGES_BRANCH
```

### GitHub Pages / Static Hosting
For static hosting without server-side header injection, version info is available via:
- `GET /version.json` (machine-readable)
- Client-side: `import { COMMIT_SHA, BUILD_ID } from '@/lib/build-info'`

### Custom Server/CDN
Inject headers using your server framework or CDN configuration, reading from environment variables set during CI/CD.