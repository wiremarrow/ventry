#!/bin/bash
# Database admin operations script
# This script runs database operations with admin (superuser) privileges
# 
# Supported operations:
# - Migrations: db push, migrate dev, migrate deploy, migrate reset
# - Seeding: seed, seed --basic, seed --comprehensive, seed --multi-org
# - Other Prisma commands that require admin access
#
# Why this is needed:
# The application uses two database users for security:
# - ventry_app: Runtime user with RLS enabled (used by the application)
# - ventry: Admin user with BYPASSRLS=true (used for migrations/seeding)
# This script ensures admin operations use the admin connection

# Load environment variables
set -a
source ../../.env
set +a

# Check if DATABASE_ADMIN_URL is set
if [ -z "$DATABASE_ADMIN_URL" ]; then
    echo "❌ Error: DATABASE_ADMIN_URL is not set in .env file"
    echo ""
    echo "Admin database operations require superuser privileges. Please ensure your .env file contains:"
    echo ""
    echo "# Admin connection (for migrations/seeding/schema changes)"
    echo "DATABASE_ADMIN_URL=postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev"
    echo ""
    echo "# Application connection (for runtime queries with RLS)"
    echo "DATABASE_URL=postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_dev"
    echo ""
    exit 1
fi

# Temporarily set DATABASE_URL to admin connection
export DATABASE_URL="$DATABASE_ADMIN_URL"

echo "🔧 Running database admin operation..."
echo "📍 Using DATABASE_URL: ${DATABASE_URL%@*}@***" # Hide password in output

# Handle different commands
case "$1" in
    "seed")
        # Handle seed commands
        shift # Remove 'seed' from arguments
        if [ "$1" = "--multi-org" ]; then
            echo "🌱 Running multi-org seed with admin connection..."
            tsx prisma/seed-multi-org.ts
        elif [ "$1" = "--multi-org-comprehensive" ]; then
            echo "🌱 Running comprehensive multi-org seed with admin connection..."
            tsx prisma/seed-multi-org-comprehensive.ts
        else
            echo "🌱 Running seed with admin connection..."
            tsx prisma/seed.ts "$@"
        fi
        ;;
    *)
        # All other commands go to Prisma
        echo "🔧 Running Prisma command: prisma $@"
        npx prisma "$@"
        ;;
esac