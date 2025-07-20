# Database Maintenance Guide

This guide covers PostgreSQL maintenance procedures, optimization strategies, and best practices for keeping Ventry's database performant and healthy.

## Maintenance Overview

### Maintenance Schedule

| Task | Frequency | Duration | Impact |
|------|-----------|----------|---------|
| VACUUM ANALYZE | Daily | 5-30 min | Low |
| Update Statistics | Daily | 1-5 min | None |
| Reindex | Weekly | 30-60 min | Medium |
| Full VACUUM | Monthly | 1-4 hours | High |
| Partition Maintenance | Monthly | 30 min | Low |
| Archive Old Data | Quarterly | 2-8 hours | Medium |

## Automated Maintenance

### 1. Daily Maintenance Script

```bash
#!/bin/bash
# /scripts/daily-db-maintenance.sh

# Configuration
DB_HOST="postgres.ventry.internal"
DB_NAME="ventry"
DB_USER="maintenance"
LOG_FILE="/var/log/postgres/maintenance-$(date +%Y%m%d).log"

# Start logging
echo "=== Database Maintenance Started: $(date) ===" >> $LOG_FILE

# Update table statistics
psql -h $DB_HOST -U $DB_USER -d $DB_NAME >> $LOG_FILE 2>&1 <<EOF
-- Analyze all tables
ANALYZE;

-- Vacuum tables with high write activity
VACUUM ANALYZE orders;
VACUUM ANALYZE inventory;
VACUUM ANALYZE stock_movements;
VACUUM ANALYZE audit_logs;

-- Update pg_stat_statements
SELECT pg_stat_statements_reset();
EOF

# Check for bloated tables
psql -h $DB_HOST -U $DB_USER -d $DB_NAME >> $LOG_FILE 2>&1 <<EOF
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  CASE WHEN pg_total_relation_size(schemaname||'.'||tablename) > 1073741824 
    THEN 'NEEDS ATTENTION' 
    ELSE 'OK' 
  END as status
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND pg_total_relation_size(schemaname||'.'||tablename) > 104857600 -- 100MB
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
EOF

# Check index usage
psql -h $DB_HOST -U $DB_USER -d $DB_NAME >> $LOG_FILE 2>&1 <<EOF
-- Find unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan < 50
  AND indexname NOT LIKE 'pg_toast%'
  AND pg_relation_size(indexrelid) > 5242880 -- 5MB
ORDER BY pg_relation_size(indexrelid) DESC;
EOF

echo "=== Database Maintenance Completed: $(date) ===" >> $LOG_FILE

# Send summary email
mail -s "Database Maintenance Report - $(date +%Y-%m-%d)" ops@ventry.com < $LOG_FILE
```

### 2. PostgreSQL Configuration

```ini
# postgresql.conf - Maintenance settings

# Autovacuum configuration
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 60
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05
autovacuum_vacuum_cost_delay = 10ms
autovacuum_vacuum_cost_limit = 1000

# Prevent transaction ID wraparound
autovacuum_freeze_max_age = 200000000
vacuum_freeze_min_age = 50000000

# Logging for maintenance
log_autovacuum_min_duration = 1000  # Log autovacuum > 1 second
log_min_duration_statement = 1000    # Log queries > 1 second
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Performance during maintenance
maintenance_work_mem = 1GB
max_parallel_maintenance_workers = 4
```

## Table Maintenance

### 1. Bloat Detection and Removal

```sql
-- Check table bloat
WITH constants AS (
  SELECT current_setting('block_size')::numeric AS bs, 23 AS hdr, 8 AS ma
),
bloat_info AS (
  SELECT
    ma,bs,schemaname,tablename,
    (datawidth+(hdr+ma-(CASE WHEN hdr%ma=0 THEN ma ELSE hdr%ma END)))::numeric AS datahdr,
    (maxfracsum*(nullhdr+ma-(CASE WHEN nullhdr%ma=0 THEN ma ELSE nullhdr%ma END))) AS nullhdr2
  FROM (
    SELECT
      schemaname, tablename, hdr, ma, bs,
      SUM((1-null_frac)*avg_width) AS datawidth,
      MAX(null_frac) AS maxfracsum,
      hdr+(
        SELECT 1+COUNT(*)/8
        FROM pg_stats s2
        WHERE null_frac<>0 AND s2.schemaname = s.schemaname AND s2.tablename = s.tablename
      ) AS nullhdr
    FROM pg_stats s, constants
    GROUP BY 1,2,3,4,5
  ) AS foo
),
table_bloat AS (
  SELECT
    schemaname, tablename, cc.relpages, bs,
    CEIL((cc.reltuples*((datahdr+ma-
      (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END))+nullhdr2+4))/(bs-20::FLOAT)) AS otta
  FROM bloat_info
  JOIN pg_class cc ON cc.relname = bloat_info.tablename
  JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = bloat_info.schemaname AND nn.nspname <> 'information_schema'
)
SELECT
  schemaname,
  tablename,
  ROUND((CASE WHEN otta=0 THEN 0.0 ELSE (relpages-otta)::NUMERIC/relpages END)*100,1) AS bloat_pct,
  pg_size_pretty((relpages-otta)*bs::bigint) AS bloat_size,
  pg_size_pretty(relpages*bs::bigint) AS table_size
FROM table_bloat
WHERE relpages > 128 -- 1MB
  AND ROUND((CASE WHEN otta=0 THEN 0.0 ELSE (relpages-otta)::NUMERIC/relpages END)*100,1) > 20
ORDER BY (relpages-otta) DESC;
```

### 2. Table Reorganization

```sql
-- Online table reorganization using pg_repack
-- Install: CREATE EXTENSION pg_repack;

-- Repack a specific table
SELECT pg_repack.repack_table('public.orders');

-- Repack all tables in a schema
SELECT pg_repack.repack_schema('public');

-- Alternative: Manual reorganization
-- Step 1: Create new table
CREATE TABLE orders_new (LIKE orders INCLUDING ALL);

-- Step 2: Copy data
INSERT INTO orders_new SELECT * FROM orders;

-- Step 3: Swap tables
BEGIN;
ALTER TABLE orders RENAME TO orders_old;
ALTER TABLE orders_new RENAME TO orders;
COMMIT;

-- Step 4: Drop old table
DROP TABLE orders_old;
```

## Index Maintenance

### 1. Index Analysis

```sql
-- Find duplicate indexes
SELECT 
  idx1.indrelid::regclass AS table_name,
  idx1.indexrelid::regclass AS index1,
  idx2.indexrelid::regclass AS index2,
  pg_size_pretty(pg_relation_size(idx1.indexrelid)) AS size1,
  pg_size_pretty(pg_relation_size(idx2.indexrelid)) AS size2
FROM pg_index idx1
JOIN pg_index idx2 ON idx1.indrelid = idx2.indrelid 
  AND idx1.indexrelid != idx2.indexrelid
WHERE idx1.indkey = idx2.indkey
  AND idx1.indpred IS NOT DISTINCT FROM idx2.indpred
  AND idx1.indexprs IS NOT DISTINCT FROM idx2.indexprs;

-- Find missing indexes (high sequential scans)
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  CASE WHEN seq_scan > 0 
    THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2) 
    ELSE 100 
  END AS idx_scan_pct
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND seq_scan > 1000
  AND seq_tup_read > 100000
  AND CASE WHEN seq_scan > 0 
    THEN 100.0 * idx_scan / (seq_scan + idx_scan) 
    ELSE 100 
  END < 95
ORDER BY seq_tup_read DESC;
```

### 2. Index Rebuilding

```sql
-- Concurrent index rebuild
CREATE INDEX CONCURRENTLY idx_orders_customer_new 
  ON orders(customer_id, created_at DESC);
  
DROP INDEX CONCURRENTLY idx_orders_customer;

ALTER INDEX idx_orders_customer_new 
  RENAME TO idx_orders_customer;

-- Rebuild all indexes on a table
REINDEX TABLE CONCURRENTLY orders;

-- Monitor index rebuild progress
SELECT 
  a.query,
  p.phase,
  p.blocks_total,
  p.blocks_done,
  p.tuples_total,
  p.tuples_done
FROM pg_stat_activity a
JOIN pg_stat_progress_create_index p ON a.pid = p.pid;
```

## Partitioning Management

### 1. Time-Based Partitioning

```sql
-- Create partitioned table
CREATE TABLE audit_logs (
  id BIGSERIAL,
  created_at TIMESTAMP NOT NULL,
  user_id TEXT,
  action TEXT,
  details JSONB
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2024_01 
  PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_logs_2024_02 
  PARTITION OF audit_logs
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automated partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Create partition for next month
  start_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');
  
  -- Check if partition exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    
    -- Create indexes on partition
    EXECUTE format(
      'CREATE INDEX %I ON %I (user_id, created_at)',
      partition_name || '_user_idx', partition_name
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('create-partitions', '0 0 25 * *', 
  'SELECT create_monthly_partition()');
```

### 2. Partition Maintenance

```sql
-- Drop old partitions
CREATE OR REPLACE FUNCTION drop_old_partitions()
RETURNS void AS $$
DECLARE
  partition RECORD;
  retention_date DATE;
BEGIN
  retention_date := CURRENT_DATE - INTERVAL '6 months';
  
  FOR partition IN 
    SELECT 
      schemaname,
      tablename
    FROM pg_tables
    WHERE tablename LIKE 'audit_logs_%'
      AND tablename < 'audit_logs_' || TO_CHAR(retention_date, 'YYYY_MM')
  LOOP
    EXECUTE format('DROP TABLE %I.%I', 
      partition.schemaname, partition.tablename);
    
    RAISE NOTICE 'Dropped partition: %', partition.tablename;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Archive before dropping
CREATE OR REPLACE FUNCTION archive_partition(partition_name TEXT)
RETURNS void AS $$
BEGIN
  -- Export to S3
  EXECUTE format(
    'COPY %I TO PROGRAM ''aws s3 cp - s3://ventry-archive/%s.csv''',
    partition_name, partition_name
  );
  
  -- Then drop
  EXECUTE format('DROP TABLE %I', partition_name);
END;
$$ LANGUAGE plpgsql;
```

## Performance Optimization

### 1. Query Performance Analysis

```sql
-- Enable query stats
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top slow queries
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  stddev_exec_time,
  rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Queries with high variance
SELECT 
  query,
  calls,
  mean_exec_time,
  stddev_exec_time,
  stddev_exec_time / NULLIF(mean_exec_time, 0) AS coefficient_of_variation
FROM pg_stat_statements
WHERE calls > 100
  AND stddev_exec_time / NULLIF(mean_exec_time, 0) > 1
ORDER BY coefficient_of_variation DESC;

-- Missing index hints
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
  AND attname NOT IN (
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid 
      AND a.attnum = ANY(i.indkey)
  );
```

### 2. Connection Pool Tuning

```sql
-- Monitor connection usage
SELECT 
  datname,
  count(*) as connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  max(EXTRACT(EPOCH FROM (now() - state_change))) as max_idle_seconds
FROM pg_stat_activity
GROUP BY datname;

-- Find long-running queries
SELECT 
  pid,
  now() - query_start AS duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;

-- Connection pool recommendations
SELECT 
  'Recommended pool size' as metric,
  GREATEST(
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    4
  ) * 2 as value
UNION ALL
SELECT 
  'Current connections' as metric,
  count(*) as value
FROM pg_stat_activity
WHERE datname = 'ventry';
```

## Monitoring and Alerts

### 1. Health Check Queries

```sql
-- Database size growth
SELECT 
  pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
  ROUND(
    100.0 * pg_database_size(pg_database.datname) / 
    LAG(pg_database_size(pg_database.datname), 1, pg_database_size(pg_database.datname)) 
    OVER (ORDER BY pg_database.datname) - 100, 
    2
  ) AS growth_pct
FROM pg_database
WHERE datname NOT IN ('template0', 'template1', 'postgres');

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- Cache hit ratio
SELECT 
  'Cache Hit Ratio' as metric,
  ROUND(
    100.0 * sum(heap_blks_hit) / 
    NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 
    2
  ) AS ratio
FROM pg_statio_user_tables;
```

### 2. Automated Alerts

```typescript
// src/monitoring/db-health.ts
export class DatabaseHealthMonitor {
  async runHealthChecks() {
    const checks = [
      this.checkReplicationLag(),
      this.checkLongRunningQueries(),
      this.checkTableBloat(),
      this.checkConnectionSaturation(),
      this.checkCacheHitRatio(),
    ];
    
    const results = await Promise.all(checks);
    const failures = results.filter(r => !r.healthy);
    
    if (failures.length > 0) {
      await this.sendAlert({
        level: 'warning',
        message: 'Database health issues detected',
        details: failures,
      });
    }
  }
  
  async checkTableBloat() {
    const result = await prisma.$queryRaw`
      SELECT 
        tablename,
        bloat_pct
      FROM (
        -- Bloat query here
      ) bloat
      WHERE bloat_pct > 30
    `;
    
    return {
      healthy: result.length === 0,
      message: `${result.length} tables have >30% bloat`,
      tables: result,
    };
  }
}
```

## Maintenance Windows

### Planning Maintenance

```yaml
maintenance_windows:
  daily:
    time: "02:00-03:00 UTC"
    tasks:
      - vacuum_analyze
      - update_statistics
      - check_replication
    
  weekly:
    day: "Sunday"
    time: "03:00-05:00 UTC"
    tasks:
      - reindex_active_tables
      - analyze_slow_queries
      - cleanup_old_logs
    
  monthly:
    day: "First Sunday"
    time: "01:00-06:00 UTC"
    tasks:
      - full_vacuum_large_tables
      - partition_maintenance
      - archive_old_data
      - security_audit
```

## Emergency Procedures

### 1. Emergency Vacuum

```bash
#!/bin/bash
# Emergency vacuum when autovacuum can't keep up

# Stop autovacuum temporarily
psql -c "ALTER SYSTEM SET autovacuum = off;"
psql -c "SELECT pg_reload_conf();"

# Aggressive vacuum
psql -c "SET vacuum_cost_delay = 0;"
psql -c "VACUUM (ANALYZE, VERBOSE) orders;"

# Re-enable autovacuum
psql -c "ALTER SYSTEM SET autovacuum = on;"
psql -c "SELECT pg_reload_conf();"
```

### 2. Index Corruption Recovery

```sql
-- Detect corruption
SELECT 
  c.relname,
  pg_size_pretty(pg_relation_size(c.oid))
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE NOT i.indisvalid;

-- Fix corruption
REINDEX INDEX CONCURRENTLY corrupted_index;

-- If CONCURRENTLY fails
BEGIN;
DROP INDEX corrupted_index;
CREATE INDEX corrupted_index ON table(columns);
COMMIT;
```

## Best Practices

1. **Monitor Continuously**: Set up alerts for key metrics
2. **Automate Routine Tasks**: Use cron/pg_cron for scheduling
3. **Test in Staging**: Always test maintenance procedures
4. **Document Changes**: Keep maintenance logs
5. **Plan for Growth**: Implement partitioning early
6. **Regular Reviews**: Monthly performance reviews
7. **Backup Before Major Changes**: Always have a rollback plan

Remember: Proactive maintenance prevents emergency fixes!