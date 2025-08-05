#!/bin/bash
# Production Database Backup Script
# Performs automated backups with encryption and S3 storage

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/tmp/ventry-backups}"
S3_BUCKET="${S3_BUCKET:-ventry-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="ventry_backup_${TIMESTAMP}"
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check required tools
    for tool in pg_dump aws gpg jq; do
        if ! command -v $tool &> /dev/null; then
            error "$tool is not installed"
            exit 1
        fi
    done
    
    # Check environment variables
    if [ -z "${DATABASE_URL:-}" ]; then
        error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        error "BACKUP_ENCRYPTION_KEY environment variable is not set"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials are not configured"
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    log "Prerequisites check passed"
}

# Function to perform database backup
perform_backup() {
    log "Starting database backup..."
    
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}.sql"
    local start_time=$(date +%s)
    
    # Extract connection details from DATABASE_URL
    # Format: postgresql://user:password@host:port/database?params
    local db_regex='postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+)'
    if [[ $DATABASE_URL =~ $db_regex ]]; then
        local db_user="${BASH_REMATCH[1]}"
        local db_pass="${BASH_REMATCH[2]}"
        local db_host="${BASH_REMATCH[3]}"
        local db_port="${BASH_REMATCH[4]}"
        local db_name="${BASH_REMATCH[5]}"
    else
        error "Invalid DATABASE_URL format"
        exit 1
    fi
    
    # Set PGPASSWORD for pg_dump
    export PGPASSWORD="$db_pass"
    
    # Perform backup with progress
    log "Backing up database: $db_name"
    pg_dump \
        --host="$db_host" \
        --port="$db_port" \
        --username="$db_user" \
        --dbname="$db_name" \
        --format=custom \
        --compress=9 \
        --verbose \
        --no-owner \
        --no-privileges \
        --exclude-table-data="_prisma_migrations" \
        --file="$backup_file" \
        2>&1 | tee -a "$LOG_FILE"
    
    # Clear password
    unset PGPASSWORD
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Check backup file
    if [ ! -f "$backup_file" ]; then
        error "Backup file was not created"
        exit 1
    fi
    
    local backup_size=$(ls -lh "$backup_file" | awk '{print $5}')
    log "Backup completed in ${duration}s. Size: $backup_size"
    
    echo "$backup_file"
}

# Function to encrypt backup
encrypt_backup() {
    local backup_file="$1"
    local encrypted_file="${backup_file}.gpg"
    
    log "Encrypting backup..."
    
    # Encrypt using GPG with passphrase
    echo "$BACKUP_ENCRYPTION_KEY" | gpg \
        --batch \
        --yes \
        --passphrase-fd 0 \
        --cipher-algo AES256 \
        --compress-algo none \
        --symmetric \
        --output "$encrypted_file" \
        "$backup_file"
    
    if [ ! -f "$encrypted_file" ]; then
        error "Encryption failed"
        exit 1
    fi
    
    # Remove unencrypted backup
    rm -f "$backup_file"
    
    log "Backup encrypted successfully"
    echo "$encrypted_file"
}

# Function to upload to S3
upload_to_s3() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    local s3_path="s3://${S3_BUCKET}/$(date +%Y/%m/%d)/${file_name}"
    
    log "Uploading to S3: $s3_path"
    
    # Upload with server-side encryption
    aws s3 cp "$file_path" "$s3_path" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 \
        --metadata "backup-time=${TIMESTAMP},hostname=$(hostname)" \
        --no-progress \
        2>&1 | tee -a "$LOG_FILE"
    
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        error "S3 upload failed"
        exit 1
    fi
    
    # Verify upload
    if ! aws s3 ls "$s3_path" &> /dev/null; then
        error "S3 upload verification failed"
        exit 1
    fi
    
    log "Upload completed successfully"
    
    # Generate pre-signed URL (valid for 7 days)
    local presigned_url=$(aws s3 presign "$s3_path" --expires-in 604800)
    log "Pre-signed URL (valid for 7 days): $presigned_url"
}

# Function to create backup metadata
create_metadata() {
    local backup_file="$1"
    local metadata_file="${BACKUP_DIR}/${BACKUP_NAME}_metadata.json"
    
    log "Creating backup metadata..."
    
    # Get database statistics
    local db_stats=$(psql "$DATABASE_URL" -c "
        SELECT 
            (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
            (SELECT pg_database_size(current_database())) as database_size,
            (SELECT count(*) FROM organizations) as organization_count,
            (SELECT count(*) FROM users) as user_count,
            (SELECT count(*) FROM items) as item_count,
            (SELECT count(*) FROM orders) as order_count
    " -t -A -F',' | head -1)
    
    # Parse stats
    IFS=',' read -r table_count db_size org_count user_count item_count order_count <<< "$db_stats"
    
    # Create metadata JSON
    cat > "$metadata_file" <<EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$TIMESTAMP",
    "database_url": "${DATABASE_URL%%:*}://***",
    "backup_size": $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file"),
    "database_size": ${db_size:-0},
    "statistics": {
        "table_count": ${table_count:-0},
        "organization_count": ${org_count:-0},
        "user_count": ${user_count:-0},
        "item_count": ${item_count:-0},
        "order_count": ${order_count:-0}
    },
    "server": {
        "hostname": "$(hostname)",
        "ip": "$(curl -s https://api.ipify.org || echo 'unknown')",
        "postgresql_version": "$(psql --version | head -1)"
    },
    "backup_tool_version": "1.0.0"
}
EOF
    
    # Upload metadata to S3
    aws s3 cp "$metadata_file" "s3://${S3_BUCKET}/$(date +%Y/%m/%d)/${BACKUP_NAME}_metadata.json" \
        --content-type "application/json" \
        --server-side-encryption AES256
    
    log "Metadata created and uploaded"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || \
                       date -v-${RETENTION_DAYS}d +%Y-%m-%d)
    
    # List and delete old backups
    local deleted_count=0
    
    aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "" \
        --query "Contents[?LastModified<'${cutoff_date}'].Key" \
        --output text | tr '\t' '\n' | while read -r key; do
        
        if [[ "$key" == *"backup"* ]]; then
            log "Deleting old backup: $key"
            aws s3 rm "s3://${S3_BUCKET}/${key}"
            ((deleted_count++))
        fi
    done
    
    log "Cleaned up $deleted_count old backups"
    
    # Clean local backups
    find "$BACKUP_DIR" -name "*.gpg" -mtime +7 -delete
    find "$BACKUP_DIR" -name "*.log" -mtime +30 -delete
}

# Function to verify backup
verify_backup() {
    local encrypted_file="$1"
    
    log "Verifying backup integrity..."
    
    # Test decryption
    echo "$BACKUP_ENCRYPTION_KEY" | gpg \
        --batch \
        --yes \
        --passphrase-fd 0 \
        --decrypt "$encrypted_file" 2>/dev/null | \
        pg_restore --list - > /dev/null
    
    if [ $? -ne 0 ]; then
        error "Backup verification failed"
        exit 1
    fi
    
    log "Backup verification passed"
}

# Function to send notifications
send_notification() {
    local status="$1"
    local message="$2"
    
    # Slack notification (if configured)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local color="good"
        [ "$status" = "error" ] && color="danger"
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Database Backup $status\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Backup Name\", \"value\": \"$BACKUP_NAME\", \"short\": true},
                        {\"title\": \"Timestamp\", \"value\": \"$TIMESTAMP\", \"short\": true}
                    ]
                }]
            }" 2>/dev/null
    fi
    
    # Email notification (if configured)
    if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
        echo "$message" | mail -s "Ventry Backup $status - $BACKUP_NAME" "$NOTIFICATION_EMAIL"
    fi
}

# Main execution
main() {
    log "=== Ventry Database Backup Script ==="
    log "Backup name: $BACKUP_NAME"
    
    # Trap errors
    trap 'error "Backup failed"; send_notification "error" "Backup failed. Check logs at $LOG_FILE"; exit 1' ERR
    
    # Execute backup steps
    check_prerequisites
    
    # Perform backup
    backup_file=$(perform_backup)
    
    # Encrypt backup
    encrypted_file=$(encrypt_backup "$backup_file")
    
    # Create metadata
    create_metadata "$encrypted_file"
    
    # Upload to S3
    upload_to_s3 "$encrypted_file"
    
    # Verify backup
    verify_backup "$encrypted_file"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Clean up local files
    rm -f "$encrypted_file"
    
    # Success notification
    log "=== Backup completed successfully ==="
    send_notification "success" "Database backup completed successfully. Backup name: $BACKUP_NAME"
}

# Run main function
main "$@"