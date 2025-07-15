#!/bin/bash
# Script to apply database indexes safely
# Uses CONCURRENTLY to avoid locking tables in production

set -euo pipefail

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL="${DATABASE_URL:-}"
DRY_RUN="${DRY_RUN:-false}"
MIGRATION_FILE="packages/database/prisma/migrations/20250115_add_performance_indexes/migration.sql"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    if [ -z "$DATABASE_URL" ]; then
        error "DATABASE_URL environment variable is not set"
        exit 1
    fi

    if [ ! -f "$MIGRATION_FILE" ]; then
        error "Migration file not found: $MIGRATION_FILE"
        exit 1
    fi

    if ! command -v psql &> /dev/null; then
        error "psql is not installed"
        exit 1
    fi
}

# Analyze current indexes
analyze_current_indexes() {
    log "Analyzing current indexes..."
    
    psql "$DATABASE_URL" -c "
        SELECT 
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
    "
}

# Check table sizes
check_table_sizes() {
    log "Checking table sizes..."
    
    psql "$DATABASE_URL" -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20;
    "
}

# Apply indexes
apply_indexes() {
    log "Applying performance indexes..."
    
    if [ "$DRY_RUN" = "true" ]; then
        warn "DRY RUN MODE - No changes will be made"
        cat "$MIGRATION_FILE"
        return
    fi
    
    # Apply the migration
    psql "$DATABASE_URL" < "$MIGRATION_FILE"
    
    if [ $? -eq 0 ]; then
        log "Indexes applied successfully"
    else
        error "Failed to apply indexes"
        exit 1
    fi
}

# Analyze query performance
analyze_performance() {
    log "Analyzing query performance..."
    
    # Reset statistics
    psql "$DATABASE_URL" -c "SELECT pg_stat_reset();"
    
    # Wait a bit for some queries to run
    log "Waiting 30 seconds to collect statistics..."
    sleep 30
    
    # Check slow queries
    psql "$DATABASE_URL" -c "
        SELECT 
            query,
            calls,
            total_time,
            mean_time,
            min_time,
            max_time
        FROM pg_stat_statements
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT 10;
    " 2>/dev/null || warn "pg_stat_statements extension not available"
}

# Vacuum and analyze tables
vacuum_analyze() {
    log "Running VACUUM ANALYZE..."
    
    if [ "$DRY_RUN" = "true" ]; then
        warn "Skipping VACUUM ANALYZE in dry run mode"
        return
    fi
    
    psql "$DATABASE_URL" -c "VACUUM ANALYZE;"
    log "VACUUM ANALYZE completed"
}

# Main execution
main() {
    log "=== Database Index Application Script ==="
    
    check_prerequisites
    
    log "Database URL: ${DATABASE_URL%%@*}@***"
    log "Dry run: $DRY_RUN"
    
    # Show current state
    analyze_current_indexes
    check_table_sizes
    
    # Apply indexes
    apply_indexes
    
    # Post-application steps
    if [ "$DRY_RUN" = "false" ]; then
        vacuum_analyze
        analyze_performance
    fi
    
    log "=== Script completed successfully ==="
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --dry-run    Show what would be done without making changes"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DATABASE_URL     PostgreSQL connection string (required)"
    echo ""
    echo "Example:"
    echo "  DATABASE_URL=postgresql://user:pass@host/db $0"
    echo "  DATABASE_URL=postgresql://user:pass@host/db $0 --dry-run"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main