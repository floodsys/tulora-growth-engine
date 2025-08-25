# Deprecated Routes Check

This document explains the automated check that prevents regression of deprecated team management components and routes.

## Background

The team management functionality was consolidated to prevent confusion and ensure a single source of truth:

- **Deprecated**: `TeamsSettings.tsx` (mock data component)
- **Deprecated**: Top-level route `path="/settings/teams"` 
- **Current**: `SettingsTeams.tsx` under `SettingsLayout` at `/settings/teams`

## What the Check Does

The `scripts/check-deprecated-routes.js` script prevents:

1. **File Reintroduction**: Blocks re-adding `TeamsSettings.tsx` file
2. **Import Prevention**: Detects imports of the deprecated `TeamsSettings` component  
3. **Route Duplication**: Prevents top-level `/settings/teams` routes outside of `SettingsLayout`

## Running the Check

```bash
# Manual check
npm run check:deprecated-routes

# As part of CI
npm run lint
```

## Allowed Files

Documentation files (`.md`, `.txt`, `.json`) that mention `TeamsSettings` are allowed and will show warnings instead of errors.

## Fix Instructions

If the check fails:

1. **Remove** any `TeamsSettings.tsx` files
2. **Remove** imports of `TeamsSettings` component
3. **Use** nested routes under `SettingsLayout` for `/settings/teams`
4. **Use only** `SettingsTeams.tsx` for team management functionality

## Implementation Details

- **Canonical Route**: `/settings/teams` renders `SettingsTeams` inside `SettingsLayout`
- **RBAC**: Both dashboard and settings views use same permission hooks
- **Data Source**: All team operations use Supabase tables and `create_invite` RPC
- **Invite Links**: All invites use `/invite/accept?token=...` format