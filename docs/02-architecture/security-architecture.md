# Security Architecture

Ventry implements defense-in-depth security with multiple layers of protection for enterprise-grade data security.

## Security Principles

1. **Zero Trust**: Verify every request, trust nothing by default
2. **Least Privilege**: Minimum necessary permissions
3. **Defense in Depth**: Multiple security layers
4. **Data Isolation**: Complete multi-tenant separation
5. **Audit Everything**: Comprehensive logging

## Security Layers

### 1. Network Security

#### HTTPS/TLS
- Enforced in production
- HSTS headers
- Secure cookies only

#### CORS Configuration
```typescript
cors: {
  origin: process.env.FRONTEND_URL,
  credentials: true,
}
```

#### Rate Limiting
- API endpoint protection
- Brute force prevention
- DDoS mitigation

### 2. Application Security

#### Authentication System

**JWT-Based Authentication**
- Tokens stored in signed httpOnly cookies
- 7-day expiration with refresh capability
- No localStorage/sessionStorage usage

**Cookie Security**
```typescript
{
  httpOnly: true,    // Prevents XSS attacks
  secure: true,      // HTTPS only (production)
  sameSite: 'lax',   // CSRF protection
  signed: true,      // Prevents tampering
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}
```

#### Authorization System

**Role-Based Access Control (RBAC)**
```typescript
enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  VIEWER = 'VIEWER'
}
```

**Permission Checks**
- Middleware-based verification
- Organization context validation
- Resource-level permissions

### 3. Database Security

#### Row-Level Security (RLS)

**Dual-User Pattern**
```sql
-- Admin user (migrations only)
CREATE USER ventry WITH BYPASSRLS;

-- Application user (runtime queries)
CREATE USER ventry_app; -- No BYPASSRLS
```

**RLS Policies**
```sql
-- Enforce organization isolation
CREATE POLICY tenant_isolation ON items
  USING (organization_id = current_setting('app.current_organization_id'));
```

**Session Variables**
- Set per request via `withRLS()`
- Automatically cleared after query
- CUID format validation

#### SQL Injection Prevention

**Parameterized Queries**
- Prisma ORM prevents SQL injection
- Input validation with Zod
- CUID format enforcement at DB level

### 4. Input Validation

#### Zod Schemas
```typescript
const userInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  organizationId: z.string().cuid(),
});
```

#### Sanitization
- HTML escaping
- Path traversal prevention
- Command injection prevention

### 5. Session Management

#### Session Security
- Server-side session validation
- Automatic session expiration
- Concurrent session limits (future)

#### Organization Context
```typescript
// Priority order for organization selection
1. Request header (x-organization-id)
2. Active organization cookie
3. JWT payload default
4. First available organization
```

## Vulnerability Mitigation

### Common Vulnerabilities

#### XSS (Cross-Site Scripting)
- React automatic escaping
- Content Security Policy headers
- httpOnly cookies

#### CSRF (Cross-Site Request Forgery)
- SameSite cookies
- Origin verification
- State-changing operations require POST

#### SQL Injection
- Prisma parameterized queries
- Input validation
- Database function validation

#### Authentication Bypass
- Signed cookie verification
- JWT signature validation
- Session invalidation on logout

### Security Headers
```typescript
// Helmet.js configuration
{
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}
```

## Audit & Compliance

### Audit Logging

**What We Log**
- Authentication events
- Authorization failures
- Data modifications
- Administrative actions
- Security violations

**Log Format**
```typescript
{
  timestamp: Date,
  userId: string,
  organizationId: string,
  action: string,
  resource: string,
  result: 'success' | 'failure',
  metadata: object,
}
```

### Compliance Considerations

#### GDPR
- Data encryption at rest
- Right to deletion
- Data portability
- Consent management

#### SOC 2
- Access controls
- Change management
- Incident response
- Security monitoring

## Security Monitoring

### Real-time Monitoring
- Failed authentication attempts
- Unusual access patterns
- Permission violations
- Rate limit violations

### Sentry Integration
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});
```

## Incident Response

### Security Incident Checklist
1. Identify and contain threat
2. Assess impact and scope
3. Notify affected users
4. Implement fixes
5. Document lessons learned

### Emergency Procedures
- Database connection termination
- User session invalidation
- API endpoint disabling
- Emergency maintenance mode

## Security Best Practices

### Development
1. Never commit secrets
2. Use environment variables
3. Regular dependency updates
4. Security-focused code reviews
5. Penetration testing

### Operations
1. Regular security audits
2. Automated vulnerability scanning
3. Security training for team
4. Incident response drills
5. Security metrics tracking

## Future Security Enhancements

### Planned Improvements
1. **2FA/MFA**: Multi-factor authentication
2. **OAuth**: Social login providers
3. **API Keys**: Machine-to-machine auth
4. **IP Allowlisting**: Network restrictions
5. **Encryption**: Field-level encryption

### Advanced Features
1. **Anomaly Detection**: ML-based threat detection
2. **Zero-Knowledge**: End-to-end encryption
3. **Hardware Keys**: FIDO2/WebAuthn support
4. **Blockchain**: Audit trail immutability

## Security Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] HTTPS certificates installed
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up

### Post-Deployment
- [ ] Penetration test completed
- [ ] Security audit performed
- [ ] Incident response tested
- [ ] Team training completed
- [ ] Documentation updated

## Related Documentation

- [Row-Level Security](../04-security/row-level-security.md)
- [Authentication Guide](../04-security/authentication.md)
- [Security Audit Findings](../04-security/security-audit-findings.md)
- [Hardening Checklist](../04-security/hardening-checklist.md)