#!/bin/bash
# Migration helper script that uses the admin connection
# This ensures migrations run with superuser privileges

# Load environment variables
set -a
source ../../.env
set +a

# Check if DATABASE_ADMIN_URL is set
if [ -z "$DATABASE_ADMIN_URL" ]; then
    echo "❌ Error: DATABASE_ADMIN_URL is not set in .env file"
    echo ""
    echo "Schema operations require admin privileges. Please ensure your .env file contains:"
    echo ""
    echo "# Admin connection (for migrations/schema changes)"
    echo "DATABASE_ADMIN_URL=postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev"
    echo ""
    echo "# Application connection (for runtime queries)"
    echo "DATABASE_URL=postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_dev"
    echo ""
    exit 1
fi

# Temporarily set DATABASE_URL to admin connection for migrations
export DATABASE_URL="$DATABASE_ADMIN_URL"

# Run the migration command passed as argument
echo "🔧 Running Prisma command with admin connection..."
echo "📍 Using DATABASE_URL: ${DATABASE_URL%@*}@***" # Hide password in output

# Execute the migration command
npx prisma "$@"