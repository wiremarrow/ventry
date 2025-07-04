#!/bin/bash

# Database Backup Script
set -e

# Configuration
BACKUP_DIR="./backups"
DB_NAME="ventry_dev"
DB_USER="ventry"
DB_HOST="localhost"
DB_PORT="5432"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/ventry_backup_$TIMESTAMP.sql"

echo "🗄️  Starting database backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if PostgreSQL is running
if ! docker-compose ps | grep -q "postgres.*Up"; then
    echo "❌ PostgreSQL is not running. Please start it with 'docker-compose up -d postgres'"
    exit 1
fi

# Perform backup
echo "📦 Creating backup: $BACKUP_FILE"
docker-compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Compress the backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"

# List recent backups
echo ""
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR" | tail -5

# Clean up old backups (keep last 10)
echo "🧹 Cleaning up old backups (keeping last 10)..."
ls -t "$BACKUP_DIR"/ventry_backup_*.sql.gz | tail -n +11 | xargs -r rm

echo "✅ Backup complete: ${BACKUP_FILE}.gz"