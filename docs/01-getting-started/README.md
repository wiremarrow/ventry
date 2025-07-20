# Getting Started with Ventry

This guide will help you get Ventry up and running on your local machine.

## Table of Contents
1. [Prerequisites](./prerequisites.md)
2. [Local Development Setup](./local-development.md)
3. [External Services Configuration](./external-services.md)
4. [Troubleshooting](./troubleshooting.md)

## Quick Start

If you want to get started immediately:

```bash
# Clone the repository
git clone <repo-url>
cd ventry

# Run the automated setup script
./tools/scripts/dev-setup.sh

# Seed the database with demo data
pnpm --filter @ventry/database db:seed

# Start development servers
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:6061
- Backend API: http://localhost:6060

### Demo Credentials

After seeding, you can login with:
- **Admin**: admin@ventry.com / password123
- **Manager**: manager@ventry.com / password123
- **Employee**: employee@ventry.com / password123

## What's Next?

- [Configure external services](./external-services.md) for full functionality
- Read the [architecture overview](../02-architecture/overview.md)
- Review [coding standards](../03-development/coding-standards.md)
- Set up your [development environment](./local-development.md)

## Need Help?

- Check the [troubleshooting guide](./troubleshooting.md)
- Review [common issues](./troubleshooting.md#common-issues)
- See the [debugging guide](../03-development/debugging.md)