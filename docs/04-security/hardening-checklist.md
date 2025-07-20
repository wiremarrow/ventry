# Security Hardening Checklist

This checklist provides a comprehensive guide for hardening Ventry for production deployment.

## Pre-Deployment Security Checklist

### 🔐 Authentication & Authorization

- [ ] **JWT Configuration**
  - [ ] Strong secret (min 32 chars) from environment variable
  - [ ] Appropriate expiration time (7 days max)
  - [ ] Secure algorithm (HS256 minimum)
  - [ ] Token refresh mechanism implemented

- [ ] **Cookie Security**
  - [ ] httpOnly flag enabled
  - [ ] Secure flag enabled (HTTPS only)
  - [ ] SameSite attribute set to 'lax' or 'strict'
  - [ ] Signed cookies implemented
  - [ ] Session rotation on privilege escalation

- [ ] **Password Security**
  - [ ] Bcrypt with 12+ rounds
  - [ ] Minimum password requirements enforced
  - [ ] Password history to prevent reuse
  - [ ] Account lockout after failed attempts

- [ ] **Multi-Factor Authentication**
  - [ ] TOTP implementation
  - [ ] Backup codes generation
  - [ ] Device management
  - [ ] Recovery procedures

### 🛡️ Application Security

- [ ] **Input Validation**
  ```typescript
  // All inputs validated with Zod
  const schema = z.object({
    email: z.string().email(),
    quantity: z.number().positive().max(1000000),
    organizationId: z.string().cuid(),
  });
  ```

- [ ] **Output Encoding**
  - [ ] XSS prevention in all outputs
  - [ ] Content-Type headers set correctly
  - [ ] JSON responses properly escaped

- [ ] **Error Handling**
  - [ ] Generic error messages to users
  - [ ] Detailed errors only in logs
  - [ ] Stack traces disabled in production
  - [ ] Custom error pages

- [ ] **Rate Limiting**
  ```typescript
  // Implement rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests',
  }));
  ```

### 🗄️ Database Security

- [ ] **Row-Level Security**
  - [ ] RLS enabled on all business tables
  - [ ] Policies tested for all operations
  - [ ] No BYPASSRLS for application user
  - [ ] Context properly set/cleared per request

- [ ] **Connection Security**
  - [ ] SSL/TLS enforced
  - [ ] Connection pooling configured
  - [ ] Idle timeout set
  - [ ] Statement timeout configured

- [ ] **Access Control**
  - [ ] Separate users for app/admin
  - [ ] Minimal privileges granted
  - [ ] No public schema access
  - [ ] Regular permission audits

- [ ] **Data Protection**
  - [ ] Sensitive fields encrypted
  - [ ] Backups encrypted
  - [ ] Audit logging enabled
  - [ ] Data retention policies

### 🌐 Network Security

- [ ] **HTTPS Configuration**
  - [ ] TLS 1.2+ only
  - [ ] Strong cipher suites
  - [ ] HSTS header enabled
  - [ ] Certificate pinning (optional)

- [ ] **Security Headers**
  ```typescript
  // nextjs.config.js
  headers: [
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    },
  ]
  ```

- [ ] **CORS Configuration**
  - [ ] Whitelist allowed origins
  - [ ] Restrict methods and headers
  - [ ] Credentials handling configured
  - [ ] Preflight caching set

### 🔑 Secrets Management

- [ ] **Environment Variables**
  - [ ] All secrets in environment variables
  - [ ] No hardcoded fallbacks
  - [ ] Validation on startup
  - [ ] Secure storage (e.g., Vault)

- [ ] **Key Rotation**
  - [ ] JWT secret rotation plan
  - [ ] Database password rotation
  - [ ] API key rotation
  - [ ] Certificate renewal automation

### 📊 Monitoring & Logging

- [ ] **Security Monitoring**
  - [ ] Failed login attempts tracked
  - [ ] Unusual activity detection
  - [ ] Real-time alerts configured
  - [ ] Security dashboard

- [ ] **Audit Logging**
  - [ ] All data modifications logged
  - [ ] Authentication events tracked
  - [ ] Admin actions recorded
  - [ ] Log retention policy

- [ ] **Log Security**
  - [ ] No sensitive data in logs
  - [ ] Logs encrypted in transit
  - [ ] Access controls on log files
  - [ ] Regular log reviews

### 🚀 Deployment Security

- [ ] **Infrastructure**
  - [ ] Firewall rules configured
  - [ ] Network segmentation
  - [ ] Private subnets for database
  - [ ] Bastion host for access

- [ ] **Container Security**
  - [ ] Base images scanned
  - [ ] Non-root user in container
  - [ ] Read-only filesystem
  - [ ] Security policies enforced

- [ ] **CI/CD Security**
  - [ ] Secrets encrypted in CI
  - [ ] Build process isolated
  - [ ] Dependency scanning
  - [ ] SAST/DAST tools integrated

### 🧪 Security Testing

- [ ] **Automated Testing**
  - [ ] Security unit tests
  - [ ] RLS isolation tests
  - [ ] Authentication flow tests
  - [ ] Input validation tests

- [ ] **Manual Testing**
  - [ ] Penetration testing completed
  - [ ] Social engineering assessment
  - [ ] Physical security review
  - [ ] Third-party audit

### 📋 Compliance & Documentation

- [ ] **Policies**
  - [ ] Security policy documented
  - [ ] Incident response plan
  - [ ] Data breach procedure
  - [ ] Business continuity plan

- [ ] **Training**
  - [ ] Security training completed
  - [ ] Phishing awareness
  - [ ] Secure coding practices
  - [ ] Regular refreshers

- [ ] **Compliance**
  - [ ] GDPR requirements met
  - [ ] Data processing agreements
  - [ ] Privacy policy updated
  - [ ] Cookie consent implemented

## Production Deployment Checklist

### Before Going Live

1. **Security Scan**
   ```bash
   # Run security audit
   npm audit
   pnpm audit
   
   # Scan for secrets
   gitleaks detect
   
   # Check dependencies
   snyk test
   ```

2. **Configuration Review**
   ```bash
   # Verify environment
   node scripts/verify-env.js
   
   # Check security headers
   curl -I https://your-domain.com
   
   # Test RLS
   npm run test:security
   ```

3. **Performance & Limits**
   - [ ] Rate limiting tested under load
   - [ ] Database connection limits set
   - [ ] Memory limits configured
   - [ ] CPU limits in place

### Day 1 Tasks

- [ ] Enable security monitoring
- [ ] Configure alerts
- [ ] Verify backups working
- [ ] Test incident response
- [ ] Document access procedures

### Week 1 Tasks

- [ ] Review all logs
- [ ] Analyze security metrics
- [ ] Update security documentation
- [ ] Schedule penetration test
- [ ] Plan first security review

## Security Contacts

### Internal Contacts
- **Security Lead**: security@ventry.com
- **Incident Response**: incident@ventry.com
- **DevOps On-Call**: +1-XXX-XXX-XXXX

### External Resources
- **Security Vendor**: vendor@security.com
- **Penetration Testing**: pentest@security.com
- **Legal Counsel**: legal@lawfirm.com

## Quick Security Fixes

### If Compromised

1. **Immediate Actions**
   - [ ] Revoke all sessions
   - [ ] Rotate all secrets
   - [ ] Enable emergency mode
   - [ ] Notify security team

2. **Investigation**
   - [ ] Preserve logs
   - [ ] Identify entry point
   - [ ] Assess data impact
   - [ ] Document timeline

3. **Recovery**
   - [ ] Patch vulnerability
   - [ ] Reset user passwords
   - [ ] Audit all access
   - [ ] Notify affected users

## Security Tools

### Recommended Tools

- **Scanning**: OWASP ZAP, Burp Suite
- **Dependencies**: Snyk, npm audit
- **Secrets**: GitLeaks, TruffleHog  
- **Monitoring**: Datadog, New Relic
- **WAF**: Cloudflare, AWS WAF
- **SIEM**: Splunk, ELK Stack

### Security Commands

```bash
# Quick security check
./scripts/security-check.sh

# Update all dependencies
pnpm update --latest

# Run security tests
pnpm test:security

# Generate security report
pnpm security:report
```

## Remember

- **Security is ongoing**: This checklist is a starting point, not an end
- **Defense in depth**: Multiple layers of security
- **Least privilege**: Give minimum necessary access
- **Trust but verify**: Audit and monitor everything
- **Plan for failure**: Have incident response ready

Stay vigilant, stay secure! 🔒