#!/bin/bash

# Ventry Development Setup with SQLite
set -e

echo "🚀 Setting up Ventry development environment with SQLite..."

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
    echo "📝 Creating .env file for SQLite development..."
    cp .env.development .env
    echo "✅ Using SQLite for development (no Docker required!)"
else
    echo "⚠️  .env file already exists. To use SQLite, copy .env.development to .env"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
pnpm playwright:install

# Initialize database (will be implemented with Prisma)
# echo "🗄️ Initializing SQLite database..."
# pnpm db:push

echo "✨ Development environment setup complete!"
echo ""
echo "📚 Quick start:"
echo "  1. Run 'pnpm dev' to start the development servers"
echo "  2. Visit http://localhost:3000 for the API"
echo "  3. Visit http://localhost:3001 for the web app"
echo ""
echo "🧪 Testing:"
echo "  - pnpm test         : Run unit tests"
echo "  - pnpm test:e2e     : Run E2E tests"
echo "  - pnpm test:e2e:ui  : Run E2E tests with UI"
echo ""
echo "💡 SQLite database will be created at ./dev.db"
echo "   No Docker or PostgreSQL required for development!"