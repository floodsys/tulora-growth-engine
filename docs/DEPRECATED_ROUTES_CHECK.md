# Deprecated Routes Lint Check

## Overview
This project includes automated checks to prevent the use of deprecated invite routes, specifically `accept-new` patterns.

## Scripts

### Manual Check
```bash
npm run lint:routes
# or
node scripts/check-deprecated-routes.js
```

### CI Integration
The check runs automatically on:
- Push to `main` or `develop` branches  
- Pull requests to `main` or `develop` branches

## What it checks
- Searches for `accept-new` and `invite/accept-new` patterns
- Checks `.ts`, `.tsx`, `.js`, `.jsx`, `.md`, `.html`, `.json` files
- Excludes `node_modules`, `.git`, build directories

## Allowed exceptions
- `src/components/InviteAcceptRedirect.tsx` - needed for redirect functionality
- `scripts/check-deprecated-routes.js` - the check script itself

## How to fix violations
Replace any `accept-new` references with `/invite/accept`:

❌ `/invite/accept-new?token=xyz`  
✅ `/invite/accept?token=xyz`

## Adding to package.json
To add the script to package.json (when editable):
```json
{
  "scripts": {
    "lint:routes": "node scripts/check-deprecated-routes.js"
  }
}
```