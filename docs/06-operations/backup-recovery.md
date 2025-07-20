# Backup and Recovery Guide

This guide covers comprehensive backup strategies, recovery procedures, and disaster recovery planning for Ventry.

## Backup Strategy Overview

### 3-2-1 Rule
- **3** copies of important data
- **2** different storage media types
- **1** offsite backup copy

### Backup Types

| Type | Frequency | Retention | Recovery Time |
|------|-----------|-----------|---------------|
| Database Full | Daily | 30 days | 1-2 hours |
| Database Incremental | Hourly | 7 days | 30 minutes |
| Database Transaction Log | 15 minutes | 24 hours | 15 minutes |
| Application State | Daily | 7 days | 30 minutes |
| File Storage | Daily | 30 days | 1 hour |

## Database Backups

### 1. PostgreSQL Backup Configuration

#### Automated Backups with pg_basebackup

```bash
#!/bin/bash
# /scripts/backup-database.sh

# Configuration
BACKUP_DIR="/backups/postgres"
DB_HOST="postgres.ventry.internal"
DB_PORT="5432"
DB_NAME="ventry"
RETENTION_DAYS=30
S3_BUCKET="ventry-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p ${BACKUP_DIR}/${DATE}

# Perform base backup
pg_basebackup \
  -h ${DB_HOST} \
  -p ${DB_PORT} \
  -U replicator \
  -D ${BACKUP_DIR}/${DATE} \
  -Ft \
  -z \
  -Xs \
  -P \
  -R

# Verify backup
if [ $? -eq 0 ]; then
  echo "Backup completed successfully"
  
  # Upload to S3
  aws s3 sync ${BACKUP_DIR}/${DATE} s3://${S3_BUCKET}/postgres/${DATE}/ \
    --storage-class STANDARD_IA
  
  # Clean up old local backups
  find ${BACKUP_DIR} -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} \;
else
  echo "Backup failed!"
  # Send alert
  curl -X POST https://api.pagerduty.com/incidents \
    -H "Authorization: Token token=${PAGERDUTY_TOKEN}" \
    -d '{"incident":{"type":"incident","title":"Database backup failed"}}'
  exit 1
fi
```

#### Continuous Archiving (WAL)

```sql
-- postgresql.conf
archive_mode = on
archive_command = 'aws s3 cp %p s3://ventry-backups/wal/%f'
archive_timeout = 900  # 15 minutes
```

#### Point-in-Time Recovery Setup

```sql
-- Enable WAL archiving
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = 'aws s3 cp %p s3://ventry-backups/wal/%f';
ALTER SYSTEM SET archive_timeout = 900;

-- Reload configuration
SELECT pg_reload_conf();
```

### 2. Backup Verification

```bash
#!/bin/bash
# /scripts/verify-backup.sh

# Test restore to verification instance
BACKUP_FILE=$1
VERIFY_DIR="/tmp/verify_restore"

# Create verification directory
rm -rf ${VERIFY_DIR}
mkdir -p ${VERIFY_DIR}

# Extract backup
tar -xzf ${BACKUP_FILE} -C ${VERIFY_DIR}

# Start PostgreSQL in verification mode
pg_ctl -D ${VERIFY_DIR} -o "-p 5433" start

# Run verification queries
psql -p 5433 -d ventry -c "SELECT COUNT(*) FROM users;"
psql -p 5433 -d ventry -c "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 day';"

# Check data integrity
psql -p 5433 -d ventry -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public';" > /tmp/tables_list.txt

# Stop verification instance
pg_ctl -D ${VERIFY_DIR} stop

# Cleanup
rm -rf ${VERIFY_DIR}
```

### 3. Managed Database Backups

#### AWS RDS Configuration

```terraform
resource "aws_db_instance" "postgres" {
  # ... other configuration ...
  
  # Backup configuration
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  
  # Enable automated backups
  skip_final_snapshot       = false
  final_snapshot_identifier = "ventry-final-snapshot-${timestamp()}"
  
  # Enable point-in-time recovery
  enabled_cloudwatch_logs_exports = ["postgresql"]
}

# Backup vault for additional protection
resource "aws_backup_vault" "database" {
  name        = "ventry-database-vault"
  kms_key_arn = aws_kms_key.backup.arn
}

resource "aws_backup_plan" "database" {
  name = "ventry-database-backup-plan"
  
  rule {
    rule_name         = "daily_backups"
    target_vault_name = aws_backup_vault.database.name
    schedule          = "cron(0 3 * * ? *)"
    
    lifecycle {
      delete_after = 30
    }
    
    recovery_point_tags = {
      Environment = "production"
      Type        = "automated"
    }
  }
  
  rule {
    rule_name         = "weekly_backups"
    target_vault_name = aws_backup_vault.database.name
    schedule          = "cron(0 4 ? * SUN *)"
    
    lifecycle {
      delete_after       = 90
      cold_storage_after = 30
    }
  }
}
```

## Application State Backups

### 1. Configuration Backup

```bash
#!/bin/bash
# /scripts/backup-config.sh

# Backup all configuration
CONFIG_BACKUP="/backups/config/$(date +%Y%m%d_%H%M%S)"
mkdir -p ${CONFIG_BACKUP}

# Environment variables
kubectl get secrets -n ventry -o yaml > ${CONFIG_BACKUP}/k8s-secrets.yaml
kubectl get configmaps -n ventry -o yaml > ${CONFIG_BACKUP}/k8s-configmaps.yaml

# Infrastructure as Code
cp -r /infrastructure ${CONFIG_BACKUP}/
cp -r /terraform ${CONFIG_BACKUP}/

# Application configuration
cp -r /apps/backend/config ${CONFIG_BACKUP}/backend-config
cp -r /apps/web/.env* ${CONFIG_BACKUP}/

# Compress and encrypt
tar -czf ${CONFIG_BACKUP}.tar.gz -C ${CONFIG_BACKUP} .
gpg --encrypt --recipient backup@ventry.com ${CONFIG_BACKUP}.tar.gz

# Upload to secure storage
aws s3 cp ${CONFIG_BACKUP}.tar.gz.gpg s3://ventry-backups/config/
```

### 2. File Storage Backup

```typescript
// src/services/backup-service.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';

export class BackupService {
  private s3 = new S3Client({ region: process.env.AWS_REGION });
  
  async backupUploads() {
    const date = new Date().toISOString().split('T')[0];
    const backupFile = `/tmp/uploads-backup-${date}.tar.gz`;
    
    // Create tar archive
    await tar.create({
      gzip: true,
      file: backupFile,
      cwd: '/uploads',
    }, ['.']);
    
    // Upload to S3
    const fileStream = createReadStream(backupFile);
    await this.s3.send(new PutObjectCommand({
      Bucket: 'ventry-backups',
      Key: `uploads/${date}/uploads.tar.gz`,
      Body: fileStream,
      StorageClass: 'STANDARD_IA',
      ServerSideEncryption: 'AES256',
    }));
    
    // Log success
    logger.info('Upload backup completed', { date, size: fileStream.bytesRead });
  }
}
```

## Recovery Procedures

### 1. Database Recovery

#### Full Recovery from Backup

```bash
#!/bin/bash
# /scripts/restore-database.sh

BACKUP_DATE=$1
RESTORE_DIR="/restore/postgres"
S3_BUCKET="ventry-backups"

# Download backup from S3
aws s3 sync s3://${S3_BUCKET}/postgres/${BACKUP_DATE}/ ${RESTORE_DIR}/

# Stop current database
systemctl stop postgresql

# Move current data directory
mv /var/lib/postgresql/data /var/lib/postgresql/data.old

# Extract backup
tar -xzf ${RESTORE_DIR}/base.tar.gz -C /var/lib/postgresql/data

# Restore WAL files if needed
aws s3 sync s3://${S3_BUCKET}/wal/ /var/lib/postgresql/data/pg_wal/

# Start PostgreSQL
systemctl start postgresql

# Verify restoration
psql -U postgres -d ventry -c "SELECT version();"
psql -U postgres -d ventry -c "SELECT COUNT(*) FROM orders;"
```

#### Point-in-Time Recovery

```bash
# Create recovery configuration
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'aws s3 cp s3://ventry-backups/wal/%f %p'
recovery_target_time = '2024-01-20 15:00:00'
recovery_target_action = 'promote'
EOF

# Start recovery
pg_ctl -D /var/lib/postgresql/data start

# Monitor recovery progress
tail -f /var/lib/postgresql/data/log/postgresql.log
```

### 2. Application Recovery

```yaml
# kubernetes/restore-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: restore-application-state
spec:
  template:
    spec:
      containers:
      - name: restore
        image: ventry/restore-tools:latest
        command:
        - /bin/bash
        - -c
        - |
          # Download configuration backup
          aws s3 cp s3://ventry-backups/config/latest.tar.gz.gpg /tmp/
          
          # Decrypt
          gpg --decrypt /tmp/latest.tar.gz.gpg > /tmp/config.tar.gz
          
          # Extract
          tar -xzf /tmp/config.tar.gz -C /tmp/config
          
          # Restore Kubernetes resources
          kubectl apply -f /tmp/config/k8s-secrets.yaml
          kubectl apply -f /tmp/config/k8s-configmaps.yaml
          
          # Restart applications
          kubectl rollout restart deployment/ventry-backend
          kubectl rollout restart deployment/ventry-frontend
      restartPolicy: Never
```

## Disaster Recovery Plan

### 1. DR Infrastructure

```terraform
# terraform/disaster-recovery.tf

# Secondary region setup
provider "aws" {
  alias  = "dr"
  region = "us-west-2"
}

# Cross-region replication for S3
resource "aws_s3_bucket_replication_configuration" "backups" {
  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.backups.id
  
  rule {
    id     = "replicate-to-dr"
    status = "Enabled"
    
    destination {
      bucket        = aws_s3_bucket.backups_dr.arn
      storage_class = "STANDARD_IA"
    }
  }
}

# DR Database (RDS Read Replica)
resource "aws_db_instance" "postgres_dr" {
  provider = aws.dr
  
  replicate_source_db = aws_db_instance.postgres.id
  
  # Promote to master in DR scenario
  skip_final_snapshot = true
}
```

### 2. DR Runbook

```markdown
# Disaster Recovery Runbook

## Prerequisites
- Access to AWS Console
- PagerDuty admin access
- Backup encryption keys
- Communication channels ready

## Detection Phase (0-15 minutes)
1. Confirm primary region failure
   - [ ] Check monitoring dashboards
   - [ ] Verify network connectivity
   - [ ] Test application endpoints
   
2. Declare disaster
   - [ ] Get approval from CTO/VP
   - [ ] Activate DR team
   - [ ] Start incident communication

## Failover Phase (15-45 minutes)
1. Database failover
   ```bash
   # Promote read replica
   aws rds promote-read-replica \
     --db-instance-identifier ventry-dr \
     --region us-west-2
   ```

2. Update DNS
   ```bash
   # Update Route53 records
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456 \
     --change-batch file://dr-dns-update.json
   ```

3. Deploy applications to DR region
   ```bash
   # Update kubeconfig
   aws eks update-kubeconfig \
     --name ventry-dr-cluster \
     --region us-west-2
   
   # Deploy applications
   kubectl apply -f k8s/dr-deployment.yaml
   ```

## Validation Phase (45-60 minutes)
1. Verify services
   - [ ] Database connectivity
   - [ ] API endpoints responding
   - [ ] Frontend accessible
   - [ ] Critical workflows functional

2. Monitor performance
   - [ ] Check error rates
   - [ ] Verify data integrity
   - [ ] Monitor user reports

## Communication
- [ ] Update status page
- [ ] Send customer notification
- [ ] Internal team updates
- [ ] Prepare RCA document
```

### 3. DR Testing Schedule

```yaml
# Quarterly DR Test Plan
tests:
  - name: "Backup Restoration Test"
    frequency: "Monthly"
    duration: "2 hours"
    steps:
      - Restore database to test environment
      - Verify data integrity
      - Test application connectivity
      - Document results
      
  - name: "Partial Failover Test"
    frequency: "Quarterly"
    duration: "4 hours"
    steps:
      - Failover read traffic to DR
      - Monitor performance
      - Test critical paths
      - Failback to primary
      
  - name: "Full DR Simulation"
    frequency: "Annually"
    duration: "8 hours"
    steps:
      - Simulate primary region failure
      - Execute complete failover
      - Run all validations
      - Practice communications
      - Full failback procedure
```

## Backup Monitoring

### 1. Automated Monitoring

```typescript
// src/monitoring/backup-monitor.ts
export class BackupMonitor {
  async checkBackupHealth() {
    const checks = await Promise.all([
      this.checkLatestBackup(),
      this.checkBackupSize(),
      this.checkBackupIntegrity(),
      this.checkReplicationLag(),
    ]);
    
    const failures = checks.filter(c => !c.success);
    if (failures.length > 0) {
      await this.alertOncall(failures);
    }
    
    // Update metrics
    metrics.gauge('backup.health_score', 
      (checks.length - failures.length) / checks.length * 100
    );
  }
  
  async checkLatestBackup() {
    const latestBackup = await this.getLatestBackupTime();
    const hoursSinceBackup = (Date.now() - latestBackup) / (1000 * 60 * 60);
    
    return {
      success: hoursSinceBackup < 25, // Daily backups
      message: `Last backup was ${hoursSinceBackup.toFixed(1)} hours ago`,
    };
  }
}
```

### 2. Backup Dashboard

```sql
-- Backup monitoring queries
-- Last successful backup
SELECT 
  backup_type,
  MAX(completed_at) as last_backup,
  EXTRACT(EPOCH FROM (NOW() - MAX(completed_at)))/3600 as hours_ago
FROM backup_history
WHERE status = 'success'
GROUP BY backup_type;

-- Backup sizes trend
SELECT 
  DATE_TRUNC('day', completed_at) as backup_date,
  backup_type,
  AVG(size_bytes) as avg_size,
  MAX(size_bytes) as max_size
FROM backup_history
WHERE completed_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Failed backups
SELECT 
  backup_type,
  started_at,
  error_message,
  retry_count
FROM backup_history
WHERE status = 'failed'
  AND completed_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;
```

## Recovery Time Objectives

| Scenario | RTO | RPO | Tested |
|----------|-----|-----|--------|
| Database corruption | 30 min | 15 min | Monthly |
| Application failure | 15 min | 0 min | Weekly |
| Region failure | 60 min | 15 min | Quarterly |
| Complete disaster | 4 hours | 1 hour | Annually |

## Best Practices

1. **Test Regularly**: Monthly restore tests minimum
2. **Document Everything**: Keep runbooks updated
3. **Automate Recovery**: Reduce human error
4. **Monitor Continuously**: Catch issues early
5. **Encrypt Backups**: Security is paramount
6. **Version Control**: Track configuration changes
7. **Geographic Distribution**: Multiple regions
8. **Access Control**: Limit who can delete backups

## Backup Checklist

### Daily
- [ ] Verify all backups completed
- [ ] Check backup sizes are normal
- [ ] Review any backup failures
- [ ] Confirm replication is current

### Weekly
- [ ] Test restore procedure
- [ ] Verify backup retention
- [ ] Check storage usage
- [ ] Review backup performance

### Monthly
- [ ] Full restore test
- [ ] Update documentation
- [ ] Review RTO/RPO metrics
- [ ] Audit backup access logs

### Quarterly
- [ ] DR drill
- [ ] Backup infrastructure review
- [ ] Cost optimization
- [ ] Security audit

Remember: A backup is only as good as its last successful restore!