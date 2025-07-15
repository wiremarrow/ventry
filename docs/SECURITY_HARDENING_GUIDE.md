# Ventry Security Hardening Guide

This guide provides comprehensive security hardening instructions for the Ventry platform, covering application security, infrastructure security, and operational security best practices.

## Table of Contents

1. [Application Security](#application-security)
2. [Authentication & Authorization](#authentication--authorization)
3. [API Security](#api-security)
4. [Database Security](#database-security)
5. [Infrastructure Security](#infrastructure-security)
6. [Secret Management](#secret-management)
7. [Monitoring & Incident Response](#monitoring--incident-response)
8. [Compliance & Auditing](#compliance--auditing)

---

## Application Security

### 1.1 Input Validation

**All user inputs must be validated and sanitized:**

```typescript
// Use Zod for schema validation
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  price: z.number().positive().max(999999.99),
  description: z.string().max(5000).optional(),
});

// Sanitize HTML content
import DOMPurify from 'isomorphic-dompurify';

const sanitizedHtml = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'u', 'p', 'br'],
  ALLOWED_ATTR: [],
});
```

### 1.2 SQL Injection Prevention

**Always use parameterized queries:**

```typescript
// GOOD: Using Prisma (automatically parameterized)
const items = await prisma.item.findMany({
  where: { 
    name: { contains: searchTerm },
    organizationId: ctx.organizationId,
  }
});

// GOOD: Using raw SQL with parameters
const result = await prisma.$queryRaw`
  SELECT * FROM items 
  WHERE organization_id = ${orgId} 
  AND name ILIKE ${`%${searchTerm}%`}
`;

// BAD: Never do this
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM items WHERE name = '${searchTerm}'`
);
```

### 1.3 XSS Prevention

**Implement Content Security Policy:**

```typescript
// apps/backend/src/middleware/security.ts
export const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.ventry.com wss://realtime.ventry.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
```

### 1.4 Dependency Security

**Regular dependency audits:**

```bash
# Check for vulnerabilities
pnpm audit
npm audit --audit-level=moderate

# Update dependencies
pnpm update --interactive
pnpm update --latest

# Use Snyk for continuous monitoring
snyk test
snyk monitor
```

**Lock file integrity:**
```json
// .npmrc
package-lock=true
lockfile-version=3
engine-strict=true
```

---

## Authentication & Authorization

### 2.1 Password Security

**Strong password requirements:**

```typescript
// apps/backend/src/lib/auth/password.ts
import { z } from 'zod';
import bcrypt from 'bcrypt';
import zxcvbn from 'zxcvbn';

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain special character')
  .refine((password) => {
    const result = zxcvbn(password);
    return result.score >= 3;
  }, 'Password is too weak');

export async function hashPassword(password: string): Promise<string> {
  const validPassword = passwordSchema.parse(password);
  return bcrypt.hash(validPassword, 12);
}

export async function verifyPassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 2.2 JWT Security

**Secure JWT implementation:**

```typescript
// apps/backend/src/lib/auth/jwt.ts
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

interface TokenPayload {
  userId: string;
  organizationId: string;
  role: string;
  sessionId: string;
}

export function generateTokens(payload: TokenPayload) {
  const accessToken = jwt.sign(
    {
      ...payload,
      type: 'access',
    },
    JWT_SECRET,
    {
      expiresIn: '15m',
      issuer: 'ventry',
      audience: 'ventry-api',
      algorithm: 'HS256',
    }
  );

  const refreshToken = jwt.sign(
    {
      ...payload,
      type: 'refresh',
      jti: randomBytes(16).toString('hex'),
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'ventry',
      audience: 'ventry-api',
      algorithm: 'HS256',
    }
  );

  return { accessToken, refreshToken };
}

export function verifyToken(token: string, type: 'access' | 'refresh') {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'ventry',
      audience: 'ventry-api',
      algorithms: ['HS256'],
    }) as TokenPayload & { type: string };

    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

### 2.3 Session Management

**Secure session configuration:**

```typescript
// apps/backend/src/lib/auth/session.ts
export const sessionConfig = {
  cookie: {
    name: 'ventry_session',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.COOKIE_DOMAIN,
  },
  rolling: true,
  resave: false,
  saveUninitialized: false,
  proxy: process.env.NODE_ENV === 'production',
};

// Implement session invalidation
export async function invalidateSession(sessionId: string) {
  await redis.del(`session:${sessionId}`);
  await prisma.session.update({
    where: { id: sessionId },
    data: { 
      invalidatedAt: new Date(),
      invalidationReason: 'user_logout',
    },
  });
}
```

### 2.4 Multi-Factor Authentication

**TOTP-based MFA:**

```typescript
// apps/backend/src/lib/auth/mfa.ts
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export function generateMFASecret(userId: string) {
  const secret = speakeasy.generateSecret({
    name: `Ventry (${userId})`,
    issuer: 'Ventry',
    length: 32,
  });

  return {
    secret: secret.base32,
    qrCode: QRCode.toDataURL(secret.otpauth_url!),
  };
}

export function verifyMFAToken(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 intervals before/after
  });
}

// Backup codes
export function generateBackupCodes(): string[] {
  return Array.from({ length: 10 }, () => 
    randomBytes(4).toString('hex').toUpperCase()
  );
}
```

---

## API Security

### 3.1 Rate Limiting

**Implement tiered rate limiting:**

```typescript
// apps/backend/src/middleware/rateLimiter.ts
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiters = {
  global: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:global',
    points: 1000,
    duration: 60,
  }),
  
  auth: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:auth',
    points: 5,
    duration: 900, // 15 minutes
    blockDuration: 900,
  }),
  
  api: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:api',
    points: 100,
    duration: 60,
  }),
  
  export: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:export',
    points: 10,
    duration: 3600, // 1 hour
  }),
};

export async function rateLimitMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const limiter = rateLimiters[req.routeConfig.rateLimit || 'api'];
  const key = req.user?.id || req.ip;
  
  try {
    await limiter.consume(key);
  } catch (rejRes) {
    reply.header('Retry-After', Math.round(rejRes.msBeforeNext / 1000) || 60);
    reply.header('X-RateLimit-Limit', limiter.points);
    reply.header('X-RateLimit-Remaining', rejRes.remainingPoints || 0);
    reply.header('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString());
    
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded',
    });
  }
}
```

### 3.2 CORS Configuration

**Strict CORS policy:**

```typescript
// apps/backend/src/middleware/cors.ts
export const corsOptions = {
  origin: (origin: string, callback: Function) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // Check exact match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check wildcard subdomains
    const wildcardMatch = allowedOrigins.some(allowed => {
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return origin.endsWith(domain);
      }
      return false;
    });
    
    if (wildcardMatch) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
};
```

### 3.3 API Key Management

**Secure API key implementation:**

```typescript
// apps/backend/src/lib/auth/apiKey.ts
import { randomBytes, createHash } from 'crypto';

export function generateApiKey(): { key: string; hash: string } {
  // Generate key: prefix_randomBytes
  const prefix = 'vk_live';
  const random = randomBytes(32).toString('base64url');
  const key = `${prefix}_${random}`;
  
  // Store only hash
  const hash = createHash('sha256').update(key).digest('hex');
  
  return { key, hash };
}

export async function validateApiKey(key: string) {
  const hash = createHash('sha256').update(key).digest('hex');
  
  const apiKey = await prisma.apiKey.findFirst({
    where: { 
      keyHash: hash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { organization: true },
  });
  
  if (!apiKey) {
    throw new Error('Invalid API key');
  }
  
  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });
  
  return apiKey;
}
```

### 3.4 Request Validation

**Comprehensive request validation:**

```typescript
// apps/backend/src/middleware/validation.ts
export const validationMiddleware = async (req: FastifyRequest, reply: FastifyReply) => {
  // Validate request ID
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = randomUUID();
  }
  
  // Validate content type
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    if (!req.headers['content-type']?.includes('application/json')) {
      throw new Error('Content-Type must be application/json');
    }
  }
  
  // Validate request size
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    throw new Error('Request too large');
  }
  
  // Validate organization context
  if (req.url.includes('/api/') && !req.url.includes('/auth/')) {
    if (!req.headers['x-organization-id']) {
      throw new Error('Organization context required');
    }
  }
};
```

---

## Database Security

### 4.1 Row-Level Security (RLS)

**Implement RLS policies for all tables:**

```sql
-- Enable RLS on all tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ... for all tables

-- Create organization isolation policy
CREATE POLICY organization_isolation ON items
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Create role-based policies
CREATE POLICY admin_full_access ON items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = items.organization_id
      AND user_id = current_setting('app.current_user_id')::uuid
      AND role IN ('OWNER', 'ADMIN')
    )
  );

-- Create audit policies
CREATE POLICY audit_insert_only ON audit_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY audit_read_admin ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id')::uuid
      AND system_role = 'ADMIN'
    )
  );
```

### 4.2 Database Encryption

**Implement encryption at rest:**

```typescript
// apps/backend/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Use for sensitive fields
export const encryptedString = (field: string) => ({
  set: (value: string) => encrypt(value),
  get: (value: string) => decrypt(value),
});
```

### 4.3 Query Monitoring

**Monitor and log suspicious queries:**

```typescript
// apps/backend/src/lib/database/monitor.ts
export const queryMonitor = Prisma.defineExtension({
  query: {
    async $allOperations({ operation, model, args, query }) {
      const start = Date.now();
      
      // Check for suspicious patterns
      if (args.where && JSON.stringify(args.where).includes('$ne')) {
        logger.warn({
          operation,
          model,
          query: args,
        }, 'Suspicious query pattern detected');
      }
      
      // Check for missing organization filter
      if (model && !['User', 'Organization'].includes(model)) {
        if (!args.where?.organizationId) {
          logger.error({
            operation,
            model,
            query: args,
          }, 'Missing organization filter');
        }
      }
      
      const result = await query(args);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        logger.warn({
          operation,
          model,
          duration,
          query: args,
        }, 'Slow query detected');
      }
      
      return result;
    },
  },
});
```

### 4.4 Connection Security

**Secure database connections:**

```bash
# PostgreSQL configuration (postgresql.conf)
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
ssl_ca_file = 'root.crt'
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'
ssl_prefer_server_ciphers = on
ssl_min_protocol_version = 'TLSv1.2'

# Require SSL for all connections
hostssl all all 0.0.0.0/0 md5

# Connection limits
max_connections = 100
superuser_reserved_connections = 3
```

---

## Infrastructure Security

### 5.1 Network Security

**VPC and Security Groups:**

```terraform
# terraform/security-groups.tf
resource "aws_security_group" "backend" {
  name_prefix = "ventry-backend-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ventry-backend-sg"
  }
}

resource "aws_security_group" "database" {
  name_prefix = "ventry-database-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  tags = {
    Name = "ventry-database-sg"
  }
}
```

### 5.2 Container Security

**Secure Docker configuration:**

```dockerfile
# Security scanning
FROM aquasec/trivy:latest AS security
COPY --from=builder /app/dist /dist
RUN trivy filesystem --no-progress --security-checks vuln,config /dist

# Runtime security
FROM node:20-alpine AS runtime
RUN apk add --no-cache libcap
RUN setcap cap_net_bind_service=+ep /usr/local/bin/node

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Security headers
USER nodejs
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-deprecation --no-warnings"

# Read-only root filesystem
RUN chmod -R 555 /app
```

### 5.3 Kubernetes Security

**Pod Security Policies:**

```yaml
# k8s/pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: ventry-restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true
```

### 5.4 WAF Configuration

**Web Application Firewall rules:**

```json
{
  "Rules": [
    {
      "Name": "SQLInjectionRule",
      "Priority": 1,
      "Statement": {
        "SqliMatchStatement": {
          "FieldToMatch": {
            "AllQueryArguments": {}
          },
          "TextTransformations": [
            {
              "Priority": 0,
              "Type": "URL_DECODE"
            },
            {
              "Priority": 1,
              "Type": "HTML_ENTITY_DECODE"
            }
          ]
        }
      },
      "Action": {
        "Block": {}
      }
    },
    {
      "Name": "XSSRule",
      "Priority": 2,
      "Statement": {
        "XssMatchStatement": {
          "FieldToMatch": {
            "Body": {}
          },
          "TextTransformations": [
            {
              "Priority": 0,
              "Type": "URL_DECODE"
            }
          ]
        }
      },
      "Action": {
        "Block": {}
      }
    }
  ]
}
```

---

## Secret Management

### 6.1 HashiCorp Vault Integration

**Vault configuration:**

```typescript
// apps/backend/src/lib/vault.ts
import vault from 'node-vault';

const vaultClient = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

export async function getSecret(path: string): Promise<any> {
  try {
    const result = await vaultClient.read(`secret/data/${path}`);
    return result.data.data;
  } catch (error) {
    logger.error({ error, path }, 'Failed to retrieve secret from Vault');
    throw error;
  }
}

export async function rotateSecret(path: string, newValue: string): Promise<void> {
  await vaultClient.write(`secret/data/${path}`, {
    data: { value: newValue },
    options: {
      cas: 0,
    },
  });
}

// Auto-rotate database credentials
export async function rotateDatabaseCredentials() {
  const newPassword = randomBytes(32).toString('base64');
  
  // Update in database
  await prisma.$executeRaw`
    ALTER USER ventry_app WITH PASSWORD ${newPassword}
  `;
  
  // Update in Vault
  await rotateSecret('database/password', newPassword);
  
  // Update application
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /:[^:]+@/,
    `:${newPassword}@`
  );
}
```

### 6.2 Environment Variable Security

**Secure environment handling:**

```typescript
// apps/backend/src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Required secrets
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64),
  DATABASE_URL: z.string().url(),
  
  // API Keys
  SENTRY_DSN: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // Feature flags
  ENABLE_MFA: z.boolean().default(true),
  ENABLE_AUDIT_LOG: z.boolean().default(true),
});

export const env = envSchema.parse(process.env);

// Prevent access to raw process.env
Object.freeze(process.env);
```

### 6.3 Key Rotation

**Automated key rotation:**

```typescript
// apps/backend/src/lib/keyRotation.ts
export class KeyRotationService {
  async rotateJWTSecret() {
    const newSecret = randomBytes(32).toString('base64');
    const oldSecret = env.JWT_SECRET;
    
    // Update secret in vault
    await rotateSecret('jwt/secret', newSecret);
    
    // Grace period for old tokens
    const gracePeriod = 15 * 60 * 1000; // 15 minutes
    
    // Verify with both secrets during grace period
    setTimeout(() => {
      env.JWT_SECRET = newSecret;
    }, gracePeriod);
    
    // Log rotation
    auditLog('jwt_secret_rotated', 'system', {
      rotatedAt: new Date().toISOString(),
    });
  }
  
  async rotateCookieSecret() {
    // Similar implementation
  }
  
  async rotateEncryptionKey() {
    // Re-encrypt all sensitive data with new key
    const newKey = randomBytes(32).toString('hex');
    
    // Batch re-encryption
    const sensitiveRecords = await prisma.user.findMany({
      select: { id: true, encryptedEmail: true },
    });
    
    for (const record of sensitiveRecords) {
      const decrypted = decrypt(record.encryptedEmail, env.ENCRYPTION_KEY);
      const reencrypted = encrypt(decrypted, newKey);
      
      await prisma.user.update({
        where: { id: record.id },
        data: { encryptedEmail: reencrypted },
      });
    }
    
    env.ENCRYPTION_KEY = newKey;
  }
}
```

---

## Monitoring & Incident Response

### 7.1 Security Monitoring

**Real-time security monitoring:**

```typescript
// apps/backend/src/lib/security/monitor.ts
export class SecurityMonitor {
  private alertThresholds = {
    failedLogins: 5,
    apiErrors: 100,
    slowQueries: 50,
    suspiciousPatterns: 10,
  };
  
  async checkFailedLogins() {
    const count = await redis.get('security:failed_logins:count');
    if (parseInt(count) > this.alertThresholds.failedLogins) {
      await this.sendAlert('High failed login attempts detected', {
        count,
        threshold: this.alertThresholds.failedLogins,
      });
    }
  }
  
  async detectAnomalies() {
    // Check for unusual access patterns
    const accessPatterns = await prisma.auditLog.groupBy({
      by: ['userId', 'action'],
      where: {
        createdAt: { gte: new Date(Date.now() - 3600000) },
      },
      _count: true,
    });
    
    for (const pattern of accessPatterns) {
      if (pattern._count > 1000) {
        await this.sendAlert('Unusual access pattern detected', {
          userId: pattern.userId,
          action: pattern.action,
          count: pattern._count,
        });
      }
    }
  }
  
  private async sendAlert(message: string, data: any) {
    // Send to security team
    await emailService.send({
      to: process.env.SECURITY_TEAM_EMAIL,
      subject: `[SECURITY ALERT] ${message}`,
      template: 'security-alert',
      data,
    });
    
    // Log to SIEM
    logger.error({ security: true, ...data }, message);
    
    // Create incident
    await prisma.securityIncident.create({
      data: {
        type: 'automated_detection',
        severity: 'high',
        description: message,
        metadata: data,
      },
    });
  }
}
```

### 7.2 Incident Response Plan

**Automated incident response:**

```typescript
// apps/backend/src/lib/security/incidentResponse.ts
export class IncidentResponse {
  async handleSecurityIncident(type: string, severity: string, data: any) {
    const incident = await prisma.securityIncident.create({
      data: {
        type,
        severity,
        description: data.description,
        metadata: data,
        status: 'open',
      },
    });
    
    // Immediate actions based on type
    switch (type) {
      case 'brute_force_attack':
        await this.blockIpAddresses(data.sourceIps);
        await this.enforcePasswordReset(data.targetUsers);
        break;
        
      case 'data_breach':
        await this.enableMaintenanceMode();
        await this.revokeAllSessions();
        await this.notifyAffectedUsers(data.affectedUsers);
        break;
        
      case 'suspicious_api_usage':
        await this.revokeApiKey(data.apiKeyId);
        await this.increaseRateLimits(data.userId);
        break;
    }
    
    // Notify incident response team
    await this.notifyResponseTeam(incident);
    
    // Start forensics collection
    await this.collectForensics(incident.id);
  }
  
  private async collectForensics(incidentId: string) {
    // Collect relevant logs
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });
    
    // Store in secure location
    await s3.putObject({
      Bucket: 'ventry-forensics',
      Key: `incidents/${incidentId}/audit-logs.json`,
      Body: JSON.stringify(logs),
      ServerSideEncryption: 'AES256',
    }).promise();
  }
}
```

### 7.3 Audit Logging

**Comprehensive audit logging:**

```typescript
// apps/backend/src/lib/audit.ts
export async function auditLog(
  action: string,
  userId: string,
  metadata?: any
) {
  const log = await prisma.auditLog.create({
    data: {
      action,
      userId,
      organizationId: metadata?.organizationId,
      resourceType: metadata?.resourceType,
      resourceId: metadata?.resourceId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      metadata,
      timestamp: new Date(),
    },
  });
  
  // Real-time processing for security events
  if (isSecurityEvent(action)) {
    await redis.publish('security:events', JSON.stringify(log));
  }
  
  return log;
}

const SECURITY_EVENTS = [
  'login_failed',
  'password_reset',
  'mfa_disabled',
  'api_key_created',
  'permission_escalation',
  'bulk_export',
  'admin_access',
];

function isSecurityEvent(action: string): boolean {
  return SECURITY_EVENTS.includes(action);
}
```

---

## Compliance & Auditing

### 8.1 GDPR Compliance

**Data privacy implementation:**

```typescript
// apps/backend/src/lib/privacy.ts
export class PrivacyService {
  async exportUserData(userId: string) {
    const data = {
      user: await prisma.user.findUnique({ where: { id: userId } }),
      orders: await prisma.order.findMany({ where: { userId } }),
      auditLogs: await prisma.auditLog.findMany({ where: { userId } }),
      // ... all related data
    };
    
    // Encrypt export
    const encrypted = encrypt(JSON.stringify(data));
    
    // Store temporarily
    await s3.putObject({
      Bucket: 'ventry-gdpr-exports',
      Key: `${userId}/export-${Date.now()}.enc`,
      Body: encrypted,
      Expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }).promise();
    
    return `${userId}/export-${Date.now()}.enc`;
  }
  
  async deleteUserData(userId: string) {
    // Soft delete with anonymization
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@example.com`,
        name: 'Deleted User',
        phone: null,
        deletedAt: new Date(),
      },
    });
    
    // Anonymize related data
    await prisma.order.updateMany({
      where: { userId },
      data: {
        customerName: 'Deleted User',
        customerEmail: null,
        shippingAddress: null,
      },
    });
  }
}
```

### 8.2 SOC 2 Compliance

**Security controls:**

```typescript
// apps/backend/src/lib/compliance/soc2.ts
export class SOC2Compliance {
  // Access control
  async enforceAccessControl(userId: string, resource: string, action: string) {
    const hasAccess = await this.checkPermission(userId, resource, action);
    
    // Log all access attempts
    await auditLog('access_attempt', userId, {
      resource,
      action,
      granted: hasAccess,
    });
    
    if (!hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }
  }
  
  // Change management
  async trackChange(change: any) {
    await prisma.changeLog.create({
      data: {
        type: change.type,
        description: change.description,
        approvedBy: change.approvedBy,
        implementedBy: change.implementedBy,
        testing: change.testing,
        rollback: change.rollback,
      },
    });
  }
  
  // Availability monitoring
  async checkAvailability() {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkAPI(),
    ]);
    
    const availability = checks.filter(c => c).length / checks.length;
    
    await prisma.availabilityMetric.create({
      data: {
        timestamp: new Date(),
        availability: availability * 100,
        checks: checks,
      },
    });
  }
}
```

### 8.3 PCI DSS Compliance

**Payment card security:**

```typescript
// apps/backend/src/lib/compliance/pci.ts
export class PCICompliance {
  // Never store card numbers
  async tokenizeCard(cardNumber: string): Promise<string> {
    // Use payment provider's tokenization
    const token = await stripe.tokens.create({
      card: {
        number: cardNumber,
        // ... other card details
      },
    });
    
    return token.id;
  }
  
  // Mask card numbers in logs
  maskCardNumber(text: string): string {
    return text.replace(
      /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
      (match) => match.slice(0, 6) + '******' + match.slice(-4)
    );
  }
  
  // Secure card data transmission
  async processPayment(token: string, amount: number) {
    // Use TLS 1.2+
    const payment = await stripe.charges.create({
      amount,
      currency: 'usd',
      source: token,
      metadata: {
        environment: process.env.NODE_ENV,
      },
    });
    
    // Log without sensitive data
    auditLog('payment_processed', 'system', {
      paymentId: payment.id,
      amount: payment.amount,
      status: payment.status,
    });
    
    return payment;
  }
}
```

---

## Security Checklist

### Pre-Production
- [ ] All secrets rotated and stored in Vault
- [ ] RLS policies implemented and tested
- [ ] Rate limiting configured
- [ ] WAF rules active
- [ ] Security headers configured
- [ ] MFA enabled for all admin accounts
- [ ] Audit logging enabled
- [ ] Incident response plan tested
- [ ] Penetration testing completed
- [ ] Security training completed

### Ongoing
- [ ] Weekly dependency updates
- [ ] Monthly security audits
- [ ] Quarterly penetration tests
- [ ] Annual SOC 2 audit
- [ ] Continuous security monitoring
- [ ] Regular incident response drills
- [ ] Security awareness training
- [ ] Vulnerability disclosure program

### Incident Response Contacts
- Security Team: security@ventry.com
- On-Call: +1-xxx-xxx-xxxx
- CISO: ciso@ventry.com
- Legal: legal@ventry.com
- PR: pr@ventry.com

---

This security hardening guide should be reviewed and updated regularly as new threats emerge and security best practices evolve.