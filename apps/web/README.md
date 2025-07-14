# Ventry Web Application

The frontend application for Ventry - an AI-native enterprise inventory management system built with Next.js 15, React 18, and TypeScript.

## Overview

This is the web frontend for Ventry, providing a modern, responsive interface for inventory management. It connects to the backend API via tRPC for type-safe, real-time data operations.

## Tech Stack

- **Framework**: Next.js 15.3.5 (App Router)
- **UI Library**: React 18.3.1
- **Language**: TypeScript 5.8.3
- **API Client**: tRPC v11 with React Query
- **Styling**: Tailwind CSS v3.4.0
- **UI Components**: shadcn/ui
- **Authentication**: JWT with httpOnly cookies
- **State Management**: React Query + Zustand
- **Form Handling**: React Hook Form + Zod

## Prerequisites

- Node.js 20+ LTS
- pnpm 8+
- Backend server running on port 6060

## Development Setup

1. **Install dependencies** (from monorepo root):
   ```bash
   pnpm install
   ```

2. **Start the backend first**:
   ```bash
   pnpm --filter @ventry/backend dev
   ```

3. **Start the frontend**:
   ```bash
   pnpm --filter @ventry/web dev
   ```

4. **Access the application**:
   - Frontend: http://localhost:6061
   - Backend API: http://localhost:6060/trpc

## Authentication

The application requires authentication to access most features. Demo credentials are available after seeding the database:

```bash
# From monorepo root
pnpm --filter @ventry/database db:seed
```

**Demo Credentials**:
- Admin: `admin@ventry.com` / `admin123`
- Manager: `manager@ventry.com` / `manager123`
- User: `user@ventry.com` / `user123`

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard layout and pages
│   ├── api/               # API routes (tRPC handler)
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── inventory/        # Inventory management
│   ├── layout/           # Layout components
│   └── ui/               # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and configurations
│   ├── trpc/             # tRPC client setup
│   └── utils.ts          # Utility functions
├── providers/            # React context providers
└── public/               # Static assets
```

## Key Features

- **Inventory Management**: Real-time tracking of stock levels
- **Multi-warehouse Support**: Manage inventory across locations
- **Stock Adjustments**: Track and audit inventory changes
- **Product Catalog**: Comprehensive item management
- **Order Processing**: Sales and purchase order workflows
- **Reporting**: Analytics and insights
- **Multi-tenant**: Organization-based data isolation

## Available Scripts

```bash
# Development server (port 6061)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

## Environment Variables

The frontend uses these environment variables:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:6060

# Public App URL
NEXT_PUBLIC_APP_URL=http://localhost:6061

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

## Dependencies

Key workspace dependencies:
- `@ventry/ui`: Shared UI component library
- `@ventry/shared`: Shared types and utilities
- `@ventry/backend`: Backend types for tRPC inference

## Common Issues

1. **"Invalid credentials" error**: Ensure the database is seeded with `pnpm db:seed`
2. **API connection errors**: Verify the backend is running on port 6060
3. **Type errors**: Run `pnpm build` in the backend first to generate types

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Part of the Ventry monorepo. See root LICENSE file.