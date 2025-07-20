#!/bin/bash

# Ventry Development Environment Setup Script
set -e

echo "🚀 Setting up Ventry development environment..."

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install $1 and try again."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command "node"
check_command "pnpm"
check_command "docker"
check_command "docker-compose"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Check pnpm version
PNPM_VERSION=$(pnpm -v | cut -d'.' -f1)
if [ "$PNPM_VERSION" -lt 8 ]; then
    echo "❌ pnpm version 8 or higher is required. Current version: $(pnpm -v)"
    exit 1
fi

echo "✅ All prerequisites met!"

# Setup environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration values!"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U ventry -d ventry_dev &> /dev/null; do
    echo -n "."
    sleep 1
done
echo " Ready!"

# Create application user for RLS
echo "🔐 Creating application database user for RLS..."
./tools/scripts/setup-app-user.sh
if [ $? -ne 0 ]; then
    echo "⚠️  Failed to create application user, but continuing setup..."
fi

# Initialize database
echo "🗄️ Initializing database..."
pnpm --filter @ventry/database db:push

echo "✨ Development environment setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Update your .env file with appropriate values"
echo "  2. Run 'pnpm dev' to start the development servers"
echo "  3. Visit http://localhost:6060 for the API"
echo "  4. Visit http://localhost:6061 for the web app"
echo ""
echo "🛠️  Useful commands:"
echo "  - pnpm dev          : Start all development servers"
echo "  - pnpm build        : Build all packages"
echo "  - pnpm test         : Run all tests"
echo "  - pnpm lint         : Run linting"
echo "  - pnpm typecheck    : Run type checking"
echo "  - docker-compose up : Start all Docker services"
echo "  - docker-compose down : Stop all Docker services"