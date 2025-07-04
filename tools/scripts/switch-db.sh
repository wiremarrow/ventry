#!/bin/bash

# Database Switching Utility
set -e

echo "🔄 Database Configuration Switcher"
echo "================================="

# Function to show current database
show_current() {
    if [ -f .env ]; then
        current_db=$(grep "DATABASE_URL" .env | head -1)
        if [[ $current_db == *"file:"* ]]; then
            echo "📦 Currently using: SQLite"
        elif [[ $current_db == *"postgresql:"* ]]; then
            echo "🐘 Currently using: PostgreSQL"
        else
            echo "❓ Unknown database configuration"
        fi
        echo "   $current_db"
    else
        echo "❌ No .env file found"
    fi
}

# Function to switch to SQLite
use_sqlite() {
    echo "🔄 Switching to SQLite..."
    cp .env.development .env
    echo "✅ Now using SQLite (./dev.db)"
    echo "   No Docker required!"
}

# Function to switch to PostgreSQL
use_postgres() {
    echo "🔄 Switching to PostgreSQL..."
    cp .env.example .env
    echo "✅ Now using PostgreSQL"
    echo "   Remember to start Docker: docker-compose up -d postgres"
}

# Main menu
case "${1:-}" in
    sqlite)
        use_sqlite
        ;;
    postgres|postgresql)
        use_postgres
        ;;
    status)
        show_current
        ;;
    *)
        echo ""
        show_current
        echo ""
        echo "Usage: $0 [sqlite|postgres|status]"
        echo ""
        echo "Commands:"
        echo "  sqlite    - Switch to SQLite (no Docker needed)"
        echo "  postgres  - Switch to PostgreSQL (requires Docker)"
        echo "  status    - Show current database configuration"
        echo ""
        echo "Examples:"
        echo "  $0 sqlite   # Use SQLite for development"
        echo "  $0 postgres # Use PostgreSQL with Docker"
        ;;
esac