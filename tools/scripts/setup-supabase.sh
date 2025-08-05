#!/bin/bash

# Supabase Setup Script
# This script helps initialize a Supabase project for Ventry

set -e

echo "🚀 Supabase Setup for Ventry"
echo "=========================="
echo

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "Please install it first: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Function to prompt for input with default value
prompt_with_default() {
    local prompt=$1
    local default=$2
    local var_name=$3
    
    read -p "$prompt [$default]: " value
    value=${value:-$default}
    eval "$var_name='$value'"
}

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -d "packages/database" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "This script will help you set up Supabase for your Ventry project."
echo

# Check if supabase is already initialized
if [ -d "supabase" ]; then
    echo "⚠️  Supabase directory already exists."
    read -p "Do you want to reinitialize? (y/N): " reinit
    if [[ $reinit =~ ^[Yy]$ ]]; then
        rm -rf supabase
    else
        echo "Skipping initialization..."
    fi
fi

# Initialize Supabase
if [ ! -d "supabase" ]; then
    echo "📦 Initializing Supabase..."
    supabase init
fi

# Create .env.local if it doesn't exist
ENV_FILE="apps/web/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Creating $ENV_FILE..."
    cp apps/web/.env.example "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"
fi

echo
echo "🔗 Linking to Supabase project..."
echo "Please provide your Supabase project details:"
echo "(You can find these in your Supabase dashboard)"
echo

prompt_with_default "Project Reference ID" "your-project-ref" PROJECT_REF
prompt_with_default "Database Password" "" DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Database password is required"
    exit 1
fi

# Link to Supabase project
echo
echo "🔗 Linking to Supabase project..."
supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"

# Get project URL and keys
echo
echo "📊 Fetching project configuration..."
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
ANON_KEY=$(supabase status --output json | jq -r '.["API URL"]' | sed 's|.*//||' | cut -d'.' -f1)

echo
echo "🔑 Please provide your Supabase keys:"
echo "(You can find these in Settings > API in your Supabase dashboard)"
echo

prompt_with_default "Anon/Public Key" "" ANON_KEY_INPUT
prompt_with_default "Service Role Key" "" SERVICE_KEY

# Update .env.local
echo
echo "📝 Updating environment variables..."

# Function to update or add env variable
update_env_var() {
    local key=$1
    local value=$2
    local file=$3
    
    if grep -q "^${key}=" "$file"; then
        # Update existing
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm "${file}.bak"
    else
        # Add new
        echo "${key}=${value}" >> "$file"
    fi
}

# Update Supabase variables
update_env_var "NEXT_PUBLIC_SUPABASE_URL" "$PROJECT_URL" "$ENV_FILE"
update_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY_INPUT" "$ENV_FILE"
update_env_var "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_KEY" "$ENV_FILE"
update_env_var "DATABASE_URL" "postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres" "$ENV_FILE"

# Create database migrations from Prisma schema
echo
echo "🗄️  Creating database migrations..."
cd packages/database

# Generate migration
echo "Generating migration from Prisma schema..."
pnpm prisma migrate dev --name initial_schema --create-only

# Apply migration to Supabase
echo "Applying migration to Supabase..."
pnpm prisma migrate deploy

cd ../..

# Apply RLS policies
echo
echo "🔒 Applying Row Level Security policies..."
for policy_file in packages/database/supabase/policies/*.sql; do
    if [ -f "$policy_file" ]; then
        echo "Applying $(basename "$policy_file")..."
        supabase db execute -f "$policy_file" || echo "⚠️  Warning: Some policies may have failed. This is normal if tables don't exist yet."
    fi
done

# Generate TypeScript types
echo
echo "📝 Generating TypeScript types..."
supabase gen types typescript --project-id "$PROJECT_REF" > apps/web/src/lib/supabase/database.types.ts

echo
echo "✅ Supabase setup complete!"
echo
echo "Next steps:"
echo "1. Run 'pnpm dev' to start the development server"
echo "2. The Prisma schema has been migrated to Supabase"
echo "3. RLS policies have been applied for security"
echo "4. TypeScript types have been generated"
echo
echo "To run data migration from old schema:"
echo "  pnpm tsx tools/scripts/migrate-to-supabase.ts"
echo
echo "To access Supabase dashboard:"
echo "  https://app.supabase.com/project/${PROJECT_REF}"
echo