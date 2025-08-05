# Development Process Management

This guide covers process management commands and port usage in the Ventry monorepo.

## Commands

### Development

```bash
# Start development (with signal handling)
pnpm dev

# Start development (direct turborepo)
pnpm dev:direct

# Clean up processes and ports
pnpm dev:cleanup

# Kill specific ports
pnpm kill-ports [port1] [port2] ...
pnpm kill-ports  # defaults to 6060, 6061
```

### Process Inspection

```bash
# Check for Next.js processes
ps aux | grep -E "(next-server|next dev)" | grep -v grep

# Check specific ports
lsof -i :6060  # Backend
lsof -i :6061  # Frontend

# Check all Ventry processes
ps aux | grep ventry | grep -v grep
```

## Port Reference

### Development Ports

| Port | Service | Description |
|------|---------|-------------|
| 6060 | Backend API | tRPC + Fastify server |
| 6061 | Frontend | Next.js development server |
| 5487 | PostgreSQL | Docker PostgreSQL instance |
| 5558 | Prisma Studio | Database GUI (when running) |
| 5050 | pgAdmin | PostgreSQL admin interface |
| 6379 | Redis | Cache server (optional) |
| 3001 | Alt Backend | Alternative backend port |

### Supabase Ports (if enabled)

| Port | Service | Description |
|------|---------|-------------|
| 54321 | Supabase API | Local Supabase API |
| 54322 | Supabase DB | PostgreSQL database |
| 54323 | Supabase Studio | Admin interface |
| 54324 | Email Testing | Inbucket email server |
| 54329 | DB Pooler | Connection pooler |

## Common Scenarios

### Port Already in Use

```bash
pnpm dev:cleanup
pnpm dev
```

### High CPU Usage

```bash
pnpm kill-ports 6061
```

### Clean Restart

```bash
pnpm dev:cleanup
pnpm dev
```

## Daily Workflow

```bash
# Start development
pnpm dev

# If issues arise, restart cleanly
# Ctrl+C, then:
pnpm dev:cleanup
pnpm dev

# End of day
# Ctrl+C and wait for shutdown
pnpm dev:cleanup  # Optional final cleanup
```

## Technical Details

### Scripts

- **`dev-wrapper.js`**: Node.js wrapper that handles SIGINT/SIGTERM signals
- **`kill-ports.sh`**: Terminates processes on specified ports (SIGTERM, then SIGKILL)
- **`cleanup-dev.sh`**: Comprehensive cleanup of all development processes

### Signal Flow

1. Ctrl+C sends SIGINT to wrapper
2. Wrapper sends SIGTERM to child processes
3. 2-second grace period for cleanup
4. SIGKILL if processes persist
5. Wrapper exits cleanly

## Emergency Recovery

```bash
# Kill all Node processes (use with caution)
killall -9 node

# Clean restart
pnpm dev:cleanup
pnpm dev
```

⚠️ **Warning**: This kills ALL Node processes on your system.