# AI Voice Platform

A comprehensive AI voice communication platform built with React, Supabase, and Retell AI. Features real-time call monitoring, webhook management, agent configuration, and enterprise-grade security.

## Project Info

**URL**: https://lovable.dev/projects/82f60040-b989-4e09-8aaf-a5888522b1a2

## Features

- **Real-time Call Monitoring**: Live dashboard for ongoing calls with auto-refresh
- **Webhook Management**: Comprehensive webhook success/failure tracking with alerts
- **Agent Management**: Full lifecycle management for Retell AI agents
- **Knowledge Base Integration**: File uploads, URL sources, and text content management
- **Security**: Multi-factor authentication, step-up authentication, and role-based access
- **Observability**: Unified error mapping, telemetry, and live operations monitoring

## Quick Start

### Prerequisites

- Node.js 18+ 
- Supabase account
- Retell AI account
- Stripe account (optional, for billing)

### Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Configure required environment variables:
   ```bash
   # Supabase Configuration
   SUPABASE_URL=your-supabase-project-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

   # Retell AI Configuration
   RETELL_API_KEY=your-retell-api-key
   RETELL_WEBHOOK_SECRET=your-retell-webhook-secret

   # Application Configuration
   VITE_SUPERADMINS_EMAILS=admin@example.com
   ```

### Installation

Follow these steps to get started:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Architecture

### Frontend (React + TypeScript)
- **Real-time Components**: Live call monitoring, webhook dashboards
- **Admin Interface**: Comprehensive admin panel with security controls
- **Agent Management**: Full CRUD operations for Retell agents
- **Error Handling**: Unified error mapping with user-friendly messages

### Backend (Supabase Edge Functions)
- **Webhook Processing**: Secure Retell webhook handling with signature verification
- **API Proxying**: Centralized Retell API access with error mapping
- **Security**: MFA enforcement, rate limiting, and audit logging
- **Observability**: Comprehensive logging and monitoring

### Database (PostgreSQL)
- **Organizations**: Multi-tenant architecture with role-based access
- **Call Records**: Complete call lifecycle tracking and analytics
- **Agent Configurations**: Versioned agent settings and knowledge base associations
- **Audit Logs**: Comprehensive security and compliance logging

## Security Features

- **Multi-Factor Authentication**: TOTP-based MFA for admin actions
- **Step-up Authentication**: Additional verification for sensitive operations
- **Role-Based Access Control**: Granular permissions system
- **Webhook Signature Verification**: Cryptographic verification of incoming webhooks
- **Rate Limiting**: Protection against abuse and DoS attacks
- **Audit Logging**: Complete audit trail for compliance

### Superadmin Authorization Policy

**Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.**

- All superadmin authorization uses `supabase.rpc('is_superadmin')` exclusively
- Environment variables (VITE_SUPERADMINS_EMAILS, SUPERADMINS_EMAILS, etc.) are for UI hints and logging only
- Never use environment variables for authorization decisions

### Diagnostic Page Access

The admin diagnostic page (`/admin/_diag`) is restricted to superadmins only:

- **Production:** API probes disabled by default for security
- **Development:** All features available
- **Override:** Superadmins can enable API probes in production if needed

## API Integration

### Retell AI
- **Agents**: Create, update, publish, and manage AI agents
- **Knowledge Bases**: File uploads, URL sources, and content management
- **Phone Numbers**: Purchase, configure, and manage phone numbers
- **Calls**: Real-time call monitoring and analytics

### Webhook Security
All webhooks verify signatures using HMAC-SHA256:
```javascript
// Webhook verification automatically handled
const isValid = await verifyWebhookSignature(
  signature, 
  rawBody, 
  RETELL_WEBHOOK_SECRET
);
```

## Development

### Environment Variables
All environment access is centralized through utility modules:

**Edge Functions** (`supabase/functions/_shared/env.ts`):
```typescript
import { RETELL_API_KEY, RETELL_WEBHOOK_SECRET } from '../_shared/env.ts';
```

**Frontend** (`src/lib/env.ts`):
```typescript
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
```

## Technologies

This project is built with:

- Vite
- TypeScript  
- React
- shadcn-ui
- Tailwind CSS
- Supabase (PostgreSQL + Edge Functions)
- Retell AI

## Deployment

### Lovable Platform
Simply open [Lovable](https://lovable.dev/projects/82f60040-b989-4e09-8aaf-a5888522b1a2) and click on Share → Publish.

### Custom Domain
To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

### Environment Configuration
Set production environment variables in your deployment platform:
- Vercel: Project Settings → Environment Variables
- Netlify: Site Settings → Environment Variables  
- Railway: Project → Variables

## Monitoring & Observability

### Live Operations Dashboard
Access the admin dashboard at `/admin/observability` for:
- Real-time call monitoring
- Webhook success/failure rates
- Error analytics and alerts
- System health metrics

### Error Handling
Unified error mapper provides consistent error handling:
- Rate limiting (429) with retry logic
- Authentication failures with clear messaging
- Network errors with automatic retries
- User-friendly error messages in UI

## Editing Options

### Use Lovable
Simply visit the [Lovable Project](https://lovable.dev/projects/82f60040-b989-4e09-8aaf-a5888522b1a2) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

### Use Your Preferred IDE
If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

### Edit Directly in GitHub
- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

### Use GitHub Codespaces
- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Security

See [SECURITY.md](./SECURITY.md) for complete security policy and verification procedures.
