#!/bin/bash

# Database Reset Script
set -e

echo "⚠️  WARNING: This will reset the database and delete all data!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Database reset cancelled."
    exit 1
fi

echo "🗑️  Resetting database..."

# Stop any running services that might be using the database
echo "Stopping services..."
docker-compose stop

# Remove the PostgreSQL volume
echo "Removing PostgreSQL data..."
docker-compose down -v postgres

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U ventry -d ventry_dev &> /dev/null; do
    echo -n "."
    sleep 1
done
echo " Ready!"

# Run migrations (will be implemented later)
# echo "🏃 Running migrations..."
# pnpm db:migrate

# Run seed script (will be implemented later)
# echo "🌱 Seeding database..."
# pnpm db:seed

echo "✅ Database reset complete!"