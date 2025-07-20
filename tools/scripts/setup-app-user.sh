#!/bin/bash

# Setup Application User for Ventry RLS
# This script creates the ventry_app user required for Row-Level Security

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SQL_FILE="$SCRIPT_DIR/sql/create-app-user.sql"

echo "🔐 Ventry Application User Setup"
echo "================================"
echo ""
echo "This script creates the ventry_app user for Row-Level Security (RLS)."
echo ""

# Check if PostgreSQL is running
if ! docker ps | grep -q "postgres.*5487"; then
    echo "❌ PostgreSQL is not running!"
    echo ""
    echo "Please start PostgreSQL first:"
    echo "  ./tools/scripts/switch-db.sh start"
    echo ""
    exit 1
fi

echo "✅ PostgreSQL is running"
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec ventry-postgres-1 pg_isready -U ventry -d ventry_dev &>/dev/null; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL is not responding after 30 seconds"
        exit 1
    fi
    sleep 1
done

echo ""
echo "🚀 Creating application user..."
echo ""

# Execute the SQL script
if docker exec -i ventry-postgres-1 psql -U ventry -d postgres < "$SQL_FILE"; then
    echo ""
    echo "✅ Application user setup complete!"
    echo ""
    echo "The ventry_app user has been created with:"
    echo "  ✅ Limited privileges (no superuser)"
    echo "  ✅ RLS enforcement (no BYPASSRLS)"
    echo "  ✅ Access to all tables and functions"
    echo ""
    echo "📝 Update your .env file with these connection strings:"
    echo ""
    echo "# Admin connection (for migrations only)"
    echo "DATABASE_ADMIN_URL=postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev"
    echo ""
    echo "# Application connection (for runtime queries)"
    echo "DATABASE_URL=postgresql://ventry_app:ventry_app_password@localhost:5487/ventry_dev"
    echo ""
else
    echo ""
    echo "❌ Failed to create application user"
    echo ""
    echo "You can try running the SQL manually:"
    echo "  docker exec -i ventry-postgres-1 psql -U ventry -d postgres < $SQL_FILE"
    echo ""
    exit 1
fi

# Check if we can connect with the app user
echo "🔍 Testing application user connection..."
if docker exec ventry-postgres-1 psql -U ventry_app -d ventry_dev -c "SELECT current_user, current_database();" &>/dev/null; then
    echo "✅ Successfully connected as ventry_app!"
else
    echo "⚠️  Could not connect as ventry_app - you may need to update pg_hba.conf"
fi

echo ""
echo "🎉 Setup complete! You can now run:"
echo "   pnpm db:push    # Push schema changes"
echo "   pnpm db:seed    # Seed initial data"
echo ""