#!/bin/bash

# Database Configuration Utility (PostgreSQL Only)
set -e

echo "🐘 PostgreSQL Configuration Utility"
echo "===================================="

# Function to show current database
show_current() {
    if [ -f .env ]; then
        current_db=$(grep "DATABASE_URL" .env | head -1)
        if [[ $current_db == *"postgresql:"* ]]; then
            echo "🐘 Currently using: PostgreSQL"
            echo "   $current_db"
        else
            echo "❓ Unknown database configuration - should be PostgreSQL"
            echo "   $current_db"
        fi
    else
        echo "❌ No .env file found"
    fi
}

# Function to ensure PostgreSQL configuration
ensure_postgres() {
    echo "🔄 Setting up PostgreSQL configuration..."
    cp .env.example .env
    echo "✅ Now using PostgreSQL"
    echo "   Remember to start Docker: docker-compose up -d postgres"
}

# Function to start PostgreSQL
start_postgres() {
    echo "🚀 Starting PostgreSQL with Docker..."
    docker-compose up -d postgres
    echo "✅ PostgreSQL started"
}

# Function to stop PostgreSQL
stop_postgres() {
    echo "🛑 Stopping PostgreSQL..."
    docker-compose down postgres
    echo "✅ PostgreSQL stopped"
}

# Main menu
case "${1:-}" in
    setup|postgres|postgresql)
        ensure_postgres
        ;;
    start)
        start_postgres
        ;;
    stop)
        stop_postgres
        ;;
    status)
        show_current
        ;;
    *)
        echo ""
        show_current
        echo ""
        echo "Usage: $0 [setup|start|stop|status]"
        echo ""
        echo "Commands:"
        echo "  setup   - Setup PostgreSQL configuration (.env)"
        echo "  start   - Start PostgreSQL with Docker"
        echo "  stop    - Stop PostgreSQL"
        echo "  status  - Show current database configuration"
        echo ""
        echo "Examples:"
        echo "  $0 setup  # Setup PostgreSQL configuration"
        echo "  $0 start  # Start PostgreSQL with Docker"
        echo "  $0 stop   # Stop PostgreSQL"
        ;;
esac