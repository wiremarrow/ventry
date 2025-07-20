# Configuration Reference

Complete reference for all configuration options, environment variables, and settings in Ventry.

## Environment Variables

### Core Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NODE_ENV` | string | Yes | - | Environment: `development`, `production`, `test` |
| `PORT` | number | No | 6060 | Backend server port |
| `HOST` | string | No | 0.0.0.0 | Backend server host |
| `LOG_LEVEL` | string | No | info | Logging level: `debug`, `info`, `warn`, `error` |

### Database Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DATABASE_URL` | string | Yes | - | PostgreSQL connection string |
| `DATABASE_POOL_MIN` | number | No | 2 | Minimum pool connections |
| `DATABASE_POOL_MAX` | number | No | 10 | Maximum pool connections |
| `DATABASE_TIMEOUT` | number | No | 5000 | Query timeout in milliseconds |
| `DATABASE_SSL` | boolean | No | false | Enable SSL for database |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | boolean | No | true | Reject unauthorized SSL certs |

#### Database URL Format
```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=[schema]
```

Example:
```
postgresql://ventry:password@localhost:5432/ventry?schema=public
```

### Authentication & Security

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `JWT_SECRET` | string | Yes | - | Secret for JWT signing (min 32 chars) |
| `JWT_EXPIRES_IN` | string | No | 7d | JWT expiration time |
| `COOKIE_SECRET` | string | Yes | - | Secret for cookie signing (min 32 chars) |
| `BCRYPT_ROUNDS` | number | No | 10 | Bcrypt hashing rounds |
| `SESSION_TIMEOUT` | number | No | 3600000 | Session timeout (1 hour) |
| `CORS_ORIGIN` | string | No | * | CORS allowed origins |
| `SECURE_COOKIES` | boolean | No | true* | Use secure cookies (*false in dev) |

### External Services

#### Redis Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REDIS_URL` | string | No | - | Redis connection URL |
| `REDIS_HOST` | string | No | localhost | Redis host |
| `REDIS_PORT` | number | No | 6379 | Redis port |
| `REDIS_PASSWORD` | string | No | - | Redis password |
| `REDIS_DB` | number | No | 0 | Redis database number |
| `REDIS_TLS` | boolean | No | false | Use TLS for Redis |

#### Email Configuration (Planned Feature)

**Note**: Email functionality is planned for a future release and is not yet implemented.

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SMTP_HOST` | string | No | - | SMTP server host |
| `SMTP_PORT` | number | No | 587 | SMTP server port |
| `SMTP_SECURE` | boolean | No | false | Use TLS |
| `SMTP_USER` | string | No | - | SMTP username |
| `SMTP_PASSWORD` | string | No | - | SMTP password |
| `EMAIL_FROM` | string | No | noreply@ventry.app | Default from address |
| `EMAIL_REPLY_TO` | string | No | support@ventry.app | Reply-to address |

#### Storage Configuration (Planned Feature)

**Note**: File upload and storage functionality is planned for a future release and is not yet implemented.

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `STORAGE_TYPE` | string | No | local | Storage type: `local`, `s3`, `gcs` |
| `STORAGE_PATH` | string | No | ./uploads | Local storage path |
| `S3_BUCKET` | string | No* | - | S3 bucket name (*required if type=s3) |
| `S3_REGION` | string | No* | us-east-1 | S3 region |
| `S3_ACCESS_KEY` | string | No* | - | S3 access key |
| `S3_SECRET_KEY` | string | No* | - | S3 secret key |
| `S3_ENDPOINT` | string | No | - | Custom S3 endpoint |

### Monitoring & Analytics

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SENTRY_DSN` | string | No | - | Sentry error tracking DSN |
| `SENTRY_ENVIRONMENT` | string | No | NODE_ENV | Sentry environment |
| `SENTRY_RELEASE` | string | No | - | Application version |
| `SENTRY_TRACES_SAMPLE_RATE` | number | No | 0.1 | Trace sampling rate (0-1) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | string | No | - | OpenTelemetry endpoint |
| `OTEL_SERVICE_NAME` | string | No | ventry | Service name for traces |
| `METRICS_ENABLED` | boolean | No | false | Enable metrics collection |

### Feature Flags

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `FEATURE_MULTI_WAREHOUSE` | boolean | No | true | Enable multi-warehouse |
| `FEATURE_ADVANCED_REPORTS` | boolean | No | true | Enable advanced reporting |
| `FEATURE_AI_INSIGHTS` | boolean | No | false | Enable AI-powered insights |
| `FEATURE_WEBHOOKS` | boolean | No | true | Enable webhook support |
| `FEATURE_API_ACCESS` | boolean | No | true | Enable API access |
| `FEATURE_CUSTOM_FIELDS` | boolean | No | false | Enable custom fields |

### Rate Limiting

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | boolean | No | true | Enable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | number | No | 900000 | Window size (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | number | No | 100 | Max requests per window |
| `RATE_LIMIT_SKIP_SUCCESSFUL` | boolean | No | false | Skip successful requests |
| `RATE_LIMIT_SKIP_FAILED` | boolean | No | false | Skip failed requests |

### Development & Testing

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `MOCK_EXTERNAL_SERVICES` | boolean | No | false | Mock external API calls |
| `SEED_DATABASE` | boolean | No | false | Seed database on startup |
| `LOG_SQL` | boolean | No | false | Log SQL queries |
| `DEBUG` | string | No | - | Debug namespaces |

## Configuration Files

### Application Configuration

#### `config/default.json`
```json
{
  "app": {
    "name": "Ventry",
    "version": "1.0.0",
    "description": "Enterprise Inventory Management"
  },
  "server": {
    "port": 6060,
    "host": "0.0.0.0",
    "bodyLimit": "10mb",
    "corsOrigins": ["http://localhost:3000"]
  },
  "database": {
    "logging": false,
    "synchronize": false,
    "migrations": {
      "path": "./prisma/migrations",
      "transactional": true
    }
  },
  "auth": {
    "saltRounds": 10,
    "tokenExpiry": "7d",
    "refreshExpiry": "30d",
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSpecial": true
    }
  },
  "features": {
    "multiWarehouse": true,
    "advancedReports": true,
    "aiInsights": false,
    "webhooks": true,
    "apiAccess": true
  }
}
```

#### `config/production.json`
```json
{
  "server": {
    "corsOrigins": ["https://app.ventry.com"]
  },
  "database": {
    "ssl": {
      "rejectUnauthorized": true
    }
  },
  "auth": {
    "secureCookies": true,
    "sameSite": "strict"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

### TypeScript Configuration

#### `tsconfig.json` (Backend)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["node", "@types/jest"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### Prisma Configuration

#### `prisma/schema.prisma`
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgcrypto, uuid-ossp]
}

// Schema configuration continues...
```

### Docker Configuration

#### `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ventry
      POSTGRES_PASSWORD: ventry_dev_password
      POSTGRES_DB: ventry
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./prisma/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ventry"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Vercel Configuration

#### `vercel.json`
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "apps/web/app/api/health/route.ts": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/api/:path*",
      "destination": "https://api.ventry.app/:path*",
      "permanent": false
    }
  ]
}
```

## Settings Schema

### Organization Settings

```typescript
interface OrganizationSettings {
  // General
  timezone: string;           // IANA timezone
  currency: string;           // ISO 4217 code
  locale: string;             // BCP 47 locale
  dateFormat: string;         // Date format pattern
  timeFormat: '12h' | '24h';  // Time format
  
  // Business
  fiscalYearStart: number;    // Month (1-12)
  taxRate: number;            // Default tax rate
  leadTime: number;           // Default lead time in days
  
  // Inventory
  allowNegativeStock: boolean;
  autoReorder: boolean;
  lowStockThreshold: number;
  reorderMultiple: number;
  
  // Orders
  orderPrefix: string;
  orderNumberLength: number;
  requireApproval: boolean;
  approvalThreshold: number;
  
  // Notifications
  emailNotifications: boolean;
  smsNotifications: boolean;
  webhookNotifications: boolean;
  notificationEmail: string;
  
  // Security
  twoFactorRequired: boolean;
  sessionTimeout: number;
  ipWhitelist: string[];
  passwordExpiry: number;
}
```

### User Preferences

```typescript
interface UserPreferences {
  // Display
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
  sidebarCollapsed: boolean;
  
  // Defaults
  defaultWarehouse?: string;
  defaultView: 'grid' | 'list';
  itemsPerPage: number;
  
  // Notifications
  emailDigest: 'never' | 'daily' | 'weekly';
  desktopNotifications: boolean;
  soundEnabled: boolean;
  
  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
}
```

## Configuration Validation

### Environment Validation

```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(6060),
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
```

### Runtime Configuration

```typescript
// config/runtime.ts
export const getRuntimeConfig = () => ({
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  
  features: {
    multiWarehouse: process.env.FEATURE_MULTI_WAREHOUSE !== 'false',
    advancedReports: process.env.FEATURE_ADVANCED_REPORTS !== 'false',
    aiInsights: process.env.FEATURE_AI_INSIGHTS === 'true',
    webhooks: process.env.FEATURE_WEBHOOKS !== 'false',
    apiAccess: process.env.FEATURE_API_ACCESS !== 'false',
  },
  
  limits: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxBatchSize: 1000,
    maxExportRows: 10000,
    maxApiCallsPerHour: 1000,
  },
});
```

## Configuration Precedence

Configuration values are loaded in the following order (later sources override earlier ones):

1. Default configuration (`config/default.json`)
2. Environment-specific configuration (`config/{NODE_ENV}.json`)
3. Environment variables
4. Runtime configuration
5. Database-stored settings

## Security Considerations

### Sensitive Variables

Never commit these variables to version control:
- `DATABASE_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `REDIS_PASSWORD`
- `SMTP_PASSWORD`
- `S3_SECRET_KEY`
- `SENTRY_DSN`
- Any API keys or tokens

### Production Checklist

- [ ] All required environment variables are set
- [ ] Secrets are strong and unique
- [ ] SSL/TLS is enabled for all connections
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Security headers are configured
- [ ] Monitoring is set up
- [ ] Backups are configured

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   Error: Missing required environment variable: JWT_SECRET
   ```
   Solution: Ensure all required variables are set in `.env` or environment

2. **Invalid Configuration**
   ```
   Error: Invalid configuration: auth.tokenExpiry must be a valid duration
   ```
   Solution: Check configuration format and values

3. **Connection Failures**
   ```
   Error: Failed to connect to database
   ```
   Solution: Verify DATABASE_URL and network connectivity

### Configuration Debugging

Enable debug logging:
```bash
DEBUG=ventry:config NODE_ENV=development pnpm dev
```

Check loaded configuration:
```typescript
console.log('Loaded config:', config.util.toObject());
```

## Next Steps

1. Copy `.env.example` to `.env`
2. Configure required variables
3. Set up external services
4. Configure feature flags
5. Review security settings