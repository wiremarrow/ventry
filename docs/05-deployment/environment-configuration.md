# Environment Configuration Guide

This guide covers environment variable management, configuration best practices, and secrets handling for Ventry deployments.

## Overview

Ventry uses environment variables for configuration across different deployment environments. This approach follows the [12-factor app](https://12factor.net/) methodology.

## Environment Structure

### Environment Hierarchy

```
.env                    # Shared defaults (git-ignored)
.env.local             # Local overrides (git-ignored)
.env.development       # Development defaults
.env.test              # Test environment
.env.production        # Production settings (git-ignored)
```

### Loading Priority

1. System environment variables (highest priority)
2. `.env.local` (local overrides)
3. `.env.[NODE_ENV]` (environment-specific)
4. `.env` (shared defaults)

## Core Environment Variables

### Backend Configuration

```bash
# apps/backend/.env.example

# Environment
NODE_ENV=development|test|production
PORT=6060

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ventry
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE=10000

# Authentication
JWT_SECRET=your-jwt-secret-minimum-32-characters-long
JWT_EXPIRES_IN=7d
COOKIE_SECRET=your-cookie-secret-minimum-32-characters-long
COOKIE_MAX_AGE=604800000  # 7 days in milliseconds

# CORS
CORS_ORIGIN=http://localhost:6061
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=debug|info|warn|error
LOG_PRETTY=true|false

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000  # 1 minute

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=development
SENTRY_SAMPLE_RATE=0.1

# External Services
OPENAI_API_KEY=sk-xxx
REDIS_URL=redis://localhost:6379
S3_BUCKET=ventry-uploads
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Feature Flags
FEATURE_AI_ASSISTANT=true
FEATURE_ADVANCED_ANALYTICS=false
FEATURE_BULK_OPERATIONS=true
```

### Frontend Configuration

```bash
# apps/web/.env.example

# Public variables (exposed to browser)
NEXT_PUBLIC_API_URL=http://localhost:6060
NEXT_PUBLIC_APP_URL=http://localhost:6061
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Server-side only
SENTRY_AUTH_TOKEN=xxx
SENTRY_ORG=ventry
SENTRY_PROJECT=web
ANALYZE=false

# Feature Flags
NEXT_PUBLIC_FEATURE_AI_ASSISTANT=true
NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS=false
NEXT_PUBLIC_FEATURE_BULK_OPERATIONS=true
```

## Environment Validation

### Backend Validation

```typescript
// apps/backend/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Required
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  
  // Optional with defaults
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  CORS_ORIGIN: z.string().default('http://localhost:6061'),
  
  // Feature flags
  FEATURE_AI_ASSISTANT: z.string().transform(v => v === 'true').default('false'),
});

// Validate on startup
export const env = envSchema.parse(process.env);

// Type-safe access
console.log(env.JWT_SECRET); // TypeScript knows this exists
```

### Frontend Validation

```typescript
// apps/web/src/config/env.ts
import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_FEATURE_AI_ASSISTANT: z.string().transform(v => v === 'true'),
});

const serverEnvSchema = z.object({
  SENTRY_AUTH_TOKEN: z.string().optional(),
  ANALYZE: z.string().transform(v => v === 'true').optional(),
});

// Validate based on environment
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_FEATURE_AI_ASSISTANT: process.env.NEXT_PUBLIC_FEATURE_AI_ASSISTANT,
});

export const serverEnv = serverEnvSchema.parse(process.env);
```

## Secrets Management

### Local Development

```bash
# Use .env.local for secrets
# This file is git-ignored

# apps/backend/.env.local
DATABASE_URL=postgresql://ventry:password@localhost:5432/ventry
JWT_SECRET=development-secret-do-not-use-in-production
COOKIE_SECRET=another-development-secret
OPENAI_API_KEY=sk-development-key
```

### Production Secrets

#### AWS Secrets Manager

```typescript
// scripts/load-secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function loadSecrets() {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  
  try {
    const command = new GetSecretValueCommand({
      SecretId: `ventry/${process.env.NODE_ENV}/secrets`,
    });
    
    const response = await client.send(command);
    const secrets = JSON.parse(response.SecretString || '{}');
    
    // Merge with environment
    Object.assign(process.env, secrets);
  } catch (error) {
    console.error('Failed to load secrets:', error);
    process.exit(1);
  }
}

// Load before app starts
await loadSecrets();
```

#### HashiCorp Vault

```typescript
// scripts/vault-loader.ts
import vault from 'node-vault';

const client = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

async function loadFromVault() {
  const { data } = await client.read(`secret/data/ventry/${process.env.NODE_ENV}`);
  Object.assign(process.env, data.data);
}
```

#### Kubernetes Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ventry-secrets
type: Opaque
stringData:
  database-url: postgresql://user:pass@host:5432/ventry
  jwt-secret: your-production-jwt-secret
  cookie-secret: your-production-cookie-secret
```

## Configuration by Environment

### Development Configuration

```bash
# Optimized for developer experience
NODE_ENV=development
LOG_LEVEL=debug
LOG_PRETTY=true
CORS_ORIGIN=http://localhost:6061
DATABASE_URL=postgresql://ventry:password@localhost:5432/ventry_dev

# Enable all features for testing
FEATURE_AI_ASSISTANT=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_BULK_OPERATIONS=true
```

### Staging Configuration

```bash
# Production-like but with test data
NODE_ENV=staging
LOG_LEVEL=info
LOG_PRETTY=false
CORS_ORIGIN=https://staging.ventry.app
DATABASE_URL=postgresql://user:pass@staging-db:5432/ventry_staging

# Test new features
FEATURE_AI_ASSISTANT=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_BULK_OPERATIONS=false
```

### Production Configuration

```bash
# Optimized for performance and security
NODE_ENV=production
LOG_LEVEL=warn
LOG_PRETTY=false
CORS_ORIGIN=https://ventry.app
DATABASE_URL=postgresql://user:pass@prod-db:5432/ventry

# Only stable features
FEATURE_AI_ASSISTANT=true
FEATURE_ADVANCED_ANALYTICS=false
FEATURE_BULK_OPERATIONS=false

# Production monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1
```

## Dynamic Configuration

### Feature Flags

```typescript
// src/config/features.ts
export const features = {
  aiAssistant: env.FEATURE_AI_ASSISTANT,
  advancedAnalytics: env.FEATURE_ADVANCED_ANALYTICS,
  bulkOperations: env.FEATURE_BULK_OPERATIONS,
};

// Usage
if (features.aiAssistant) {
  // Enable AI features
}
```

### Runtime Configuration

```typescript
// src/config/runtime.ts
interface RuntimeConfig {
  maintenanceMode: boolean;
  maxUploadSize: number;
  allowedOrigins: string[];
}

// Fetch from API or config service
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/api/config');
  return response.json();
}
```

## Security Best Practices

### 1. Never Commit Secrets

```bash
# .gitignore
.env
.env.local
.env.production
*.key
*.pem
*.pfx
```

### 2. Use Strong Secrets

```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -hex 32     # For COOKIE_SECRET

# Or use a password manager
pwgen -s 32 1
```

### 3. Rotate Secrets Regularly

```typescript
// Implement key rotation
const currentKey = env.JWT_SECRET;
const previousKey = env.JWT_SECRET_PREVIOUS;

// Try current key first, fall back to previous
try {
  return jwt.verify(token, currentKey);
} catch (error) {
  if (previousKey) {
    return jwt.verify(token, previousKey);
  }
  throw error;
}
```

### 4. Limit Access

```yaml
# Use least privilege principle
- Only production servers can access production secrets
- Developers use development secrets
- CI/CD has limited access to deployment secrets
```

## Environment Variable Documentation

### Naming Conventions

```bash
# Format: [SCOPE_]CATEGORY_NAME

# Examples:
DATABASE_URL              # Core database connection
DATABASE_POOL_MAX        # Database-specific setting
NEXT_PUBLIC_API_URL      # Public frontend variable
FEATURE_AI_ASSISTANT     # Feature flag
AWS_ACCESS_KEY_ID        # External service credential
```

### Documentation Template

```typescript
/**
 * JWT_SECRET
 * 
 * Description: Secret key for signing JWT tokens
 * Type: string
 * Required: Yes
 * Default: None
 * Format: Minimum 32 characters
 * Example: "your-super-secret-jwt-key-minimum-32-chars"
 * Security: High - Never expose or commit
 * Rotation: Every 90 days
 */
```

## Troubleshooting

### Common Issues

1. **Missing Required Variable**
   ```
   Error: Missing required environment variable: JWT_SECRET
   ```
   Solution: Check `.env` files and ensure variable is set

2. **Invalid Variable Format**
   ```
   Error: DATABASE_URL must be a valid URL
   ```
   Solution: Verify format matches expected pattern

3. **Permission Denied**
   ```
   Error: Cannot read secrets from AWS Secrets Manager
   ```
   Solution: Check IAM permissions and credentials

### Debug Commands

```bash
# Check loaded environment
node -e "console.log(process.env)"

# Verify specific variable
echo $DATABASE_URL

# Test environment loading
node -r dotenv/config -e "console.log(process.env.JWT_SECRET)"

# Validate environment
pnpm validate:env
```

## CI/CD Configuration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
env:
  NODE_ENV: production

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Load production secrets
        run: |
          aws secretsmanager get-secret-value \
            --secret-id ventry/production/secrets \
            --query SecretString \
            --output text > .env.production
      
      - name: Deploy
        run: |
          source .env.production
          pnpm deploy
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    image: ventry-backend
    env_file:
      - .env
      - .env.local
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/ventry
    depends_on:
      - db
      
  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=ventry
```

## Best Practices Summary

1. **Use environment validation** - Catch errors early
2. **Separate public/private variables** - Security first
3. **Document all variables** - Help your team
4. **Use secure secret storage** - Never plain text
5. **Implement key rotation** - Regular security updates
6. **Monitor configuration changes** - Audit trail
7. **Test with production-like config** - Catch issues early
8. **Automate secret injection** - Reduce human error

Remember: Configuration is code. Treat it with the same care!