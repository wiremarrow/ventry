#!/bin/bash
# Migration helper script that uses the admin connection
# This ensures migrations run with superuser privileges

# Load environment variables
set -a
source ../../.env
set +a

# Temporarily set DATABASE_URL to admin connection for migrations
export DATABASE_URL="$DATABASE_ADMIN_URL"

# Run the migration command passed as argument
echo "Running migration with admin connection..."
echo "Using DATABASE_URL: ${DATABASE_URL%@*}@***" # Hide password in output

# Execute the migration command
npx prisma "$@"