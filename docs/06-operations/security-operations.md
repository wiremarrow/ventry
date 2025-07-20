# Security Operations Guide

This guide covers security monitoring, incident response procedures, compliance requirements, and ongoing security operations for Ventry.

## Security Operations Overview

```
┌─────────────────────────────────────────────────┐
│              Security Operations Center          │
├─────────────────────────────────────────────────┤
│  Detection  │  Response  │  Recovery │  Analysis │
└──────┬──────┴─────┬──────┴─────┬────┴─────┬─────┘
       │            │            │          │
   Monitoring    Incident    Forensics  Reporting
   & Alerts      Response    & Recovery  & Metrics
```

## Security Monitoring

### 1. Real-Time Threat Detection

```typescript
// src/security/threat-detector.ts
import { EventEmitter } from 'events';

export class ThreatDetector extends EventEmitter {
  private readonly thresholds = {
    failedLogins: 5,
    requestRate: 100,
    suspiciousPatterns: [
      /(\.\.|\/\/|\\\\)/,  // Path traversal
      /(union|select|insert|update|delete|drop)/i,  // SQL injection
      /(<script|javascript:|onerror)/i,  // XSS attempts
    ],
  };
  
  async detectThreats(event: SecurityEvent) {
    const threats = [];
    
    // Check failed login attempts
    if (event.type === 'login_failed') {
      const attempts = await this.getRecentFailedAttempts(event.ip);
      if (attempts >= this.thresholds.failedLogins) {
        threats.push({
          type: 'brute_force',
          severity: 'high',
          ip: event.ip,
          details: `${attempts} failed login attempts`,
        });
      }
    }
    
    // Check request patterns
    if (event.type === 'http_request') {
      // Rate limiting check
      const rate = await this.getRequestRate(event.ip);
      if (rate > this.thresholds.requestRate) {
        threats.push({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          ip: event.ip,
          details: `${rate} requests/minute`,
        });
      }
      
      // Pattern matching
      for (const pattern of this.thresholds.suspiciousPatterns) {
        if (pattern.test(event.path) || pattern.test(event.body)) {
          threats.push({
            type: 'suspicious_pattern',
            severity: 'high',
            ip: event.ip,
            pattern: pattern.toString(),
            details: 'Potential attack pattern detected',
          });
        }
      }
    }
    
    // Emit threats
    for (const threat of threats) {
      this.emit('threat_detected', threat);
      await this.logThreat(threat);
    }
    
    return threats;
  }
  
  private async logThreat(threat: Threat) {
    await prisma.securityLog.create({
      data: {
        type: threat.type,
        severity: threat.severity,
        ip: threat.ip,
        details: threat.details,
        timestamp: new Date(),
      },
    });
    
    // Alert security team for high severity
    if (threat.severity === 'high') {
      await this.alertSecurityTeam(threat);
    }
  }
}
```

### 2. Security Information and Event Management (SIEM)

```yaml
# filebeat configuration for security logs
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/nginx/access.log
      - /var/log/auth.log
      - /app/logs/security.log
    processors:
      - add_tags:
          tags: [security]
      - drop_event:
          when:
            regexp:
              message: '.*healthcheck.*'
              
  - type: syslog
    protocol.udp:
      host: "0.0.0.0:514"
    processors:
      - add_fields:
          fields:
            log_type: syslog
            
output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  indices:
    - index: "security-%{+yyyy.MM.dd}"
      when.contains:
        tags: "security"
```

### 3. Intrusion Detection System (IDS)

```typescript
// src/security/ids.ts
export class IntrusionDetectionSystem {
  private readonly rules = [
    {
      name: 'SQL Injection Attempt',
      pattern: /(\b(union|select|insert|update|delete|drop)\b.*\b(from|where|table)\b)/i,
      action: 'block',
      severity: 'critical',
    },
    {
      name: 'XSS Attempt',
      pattern: /<(script|iframe|object|embed|form|input)[^>]*>/i,
      action: 'block',
      severity: 'high',
    },
    {
      name: 'Directory Traversal',
      pattern: /(\.\.[\/\\]){2,}|(\.\.%2[fF]){2,}/,
      action: 'block',
      severity: 'high',
    },
    {
      name: 'Command Injection',
      pattern: /[;&|`]\s*(cat|ls|rm|mv|cp|wget|curl|nc|bash|sh)\s/i,
      action: 'block',
      severity: 'critical',
    },
  ];
  
  async inspect(request: SecurityRequest) {
    const violations = [];
    const content = `${request.path} ${request.query} ${request.body}`;
    
    for (const rule of this.rules) {
      if (rule.pattern.test(content)) {
        violations.push({
          rule: rule.name,
          severity: rule.severity,
          action: rule.action,
          matched: content.match(rule.pattern)?.[0],
        });
        
        // Take action
        if (rule.action === 'block') {
          await this.blockRequest(request, rule);
        }
      }
    }
    
    if (violations.length > 0) {
      await this.logViolations(request, violations);
      
      // Block the request
      throw new SecurityViolationError('Request blocked by IDS', violations);
    }
    
    return { safe: true };
  }
}
```

## Incident Response

### 1. Incident Response Plan

```markdown
# Incident Response Runbook

## 1. Detection & Analysis (0-15 minutes)

### Initial Assessment
- [ ] Verify the incident is real (not false positive)
- [ ] Determine incident severity (Critical/High/Medium/Low)
- [ ] Identify affected systems
- [ ] Estimate impact scope

### Severity Classification
- **Critical**: Data breach, system compromise, ransomware
- **High**: Service outage, authentication bypass, DDoS
- **Medium**: Suspicious activity, policy violations
- **Low**: Failed attacks, scanner activity

## 2. Containment (15-30 minutes)

### Immediate Actions
```bash
# Block malicious IP
iptables -A INPUT -s <malicious_ip> -j DROP

# Revoke compromised credentials
psql -c "UPDATE users SET password_hash = NULL WHERE id = '<user_id>';"

# Isolate affected systems
docker stop <affected_container>
```

### Short-term Containment
- [ ] Isolate affected systems
- [ ] Block malicious IPs/domains
- [ ] Disable compromised accounts
- [ ] Preserve evidence

## 3. Eradication (30-60 minutes)

### Remove Threat
- [ ] Identify root cause
- [ ] Remove malicious code/files
- [ ] Close vulnerabilities
- [ ] Update security controls

## 4. Recovery (1-4 hours)

### System Restoration
- [ ] Restore from clean backups
- [ ] Rebuild compromised systems
- [ ] Verify system integrity
- [ ] Monitor for reinfection

## 5. Post-Incident (Next 48 hours)

### Lessons Learned
- [ ] Document timeline
- [ ] Identify improvements
- [ ] Update procedures
- [ ] Share findings
```

### 2. Automated Incident Response

```typescript
// src/security/incident-response.ts
export class IncidentResponseAutomation {
  async handleIncident(incident: SecurityIncident) {
    logger.security('Incident detected', incident);
    
    // Create incident ticket
    const ticket = await this.createIncidentTicket(incident);
    
    // Execute automated responses based on type
    switch (incident.type) {
      case 'brute_force':
        await this.handleBruteForce(incident);
        break;
        
      case 'data_breach':
        await this.handleDataBreach(incident);
        break;
        
      case 'malware':
        await this.handleMalware(incident);
        break;
        
      case 'ddos':
        await this.handleDDoS(incident);
        break;
    }
    
    // Notify security team
    await this.notifySecurityTeam(incident, ticket);
    
    // Start evidence collection
    await this.collectEvidence(incident);
  }
  
  private async handleBruteForce(incident: SecurityIncident) {
    const { sourceIp, targetUser } = incident.details;
    
    // Block IP immediately
    await this.blockIP(sourceIp, 24 * 60 * 60); // 24 hours
    
    // Lock affected account
    if (targetUser) {
      await prisma.user.update({
        where: { id: targetUser },
        data: { 
          accountLocked: true,
          lockReason: 'Brute force attack detected',
        },
      });
    }
    
    // Enable additional monitoring
    await this.enableEnhancedMonitoring(sourceIp);
  }
  
  private async collectEvidence(incident: SecurityIncident) {
    const evidenceDir = `/forensics/${incident.id}`;
    
    // Collect logs
    await exec(`mkdir -p ${evidenceDir}/logs`);
    await exec(`cp /var/log/nginx/access.log ${evidenceDir}/logs/`);
    await exec(`journalctl --since "1 hour ago" > ${evidenceDir}/logs/system.log`);
    
    // Capture network state
    await exec(`netstat -an > ${evidenceDir}/network_connections.txt`);
    await exec(`iptables -L -n > ${evidenceDir}/firewall_rules.txt`);
    
    // Database audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });
    
    await fs.writeFile(
      `${evidenceDir}/audit_logs.json`,
      JSON.stringify(auditLogs, null, 2)
    );
    
    // Create evidence package
    await exec(`tar -czf ${evidenceDir}.tar.gz ${evidenceDir}`);
    
    // Upload to secure storage
    await this.uploadToSecureStorage(`${evidenceDir}.tar.gz`);
  }
}
```

### 3. Security Orchestration, Automation and Response (SOAR)

```typescript
// src/security/soar-playbooks.ts
export class SecurityPlaybooks {
  private playbooks = {
    suspicious_login: {
      name: 'Suspicious Login Detection',
      triggers: ['failed_login', 'unusual_location', 'impossible_travel'],
      actions: [
        'verify_user_identity',
        'check_recent_activity',
        'send_verification_email',
        'require_mfa',
        'log_incident',
      ],
    },
    
    data_exfiltration: {
      name: 'Data Exfiltration Prevention',
      triggers: ['large_download', 'unusual_access_pattern', 'bulk_export'],
      actions: [
        'throttle_connection',
        'alert_data_owner',
        'capture_network_traffic',
        'block_if_threshold_exceeded',
        'create_incident',
      ],
    },
  };
  
  async executePlaybook(trigger: string, context: any) {
    const playbook = Object.values(this.playbooks).find(p => 
      p.triggers.includes(trigger)
    );
    
    if (!playbook) return;
    
    logger.security(`Executing playbook: ${playbook.name}`, { trigger, context });
    
    for (const action of playbook.actions) {
      try {
        await this.executeAction(action, context);
      } catch (error) {
        logger.error(`Playbook action failed: ${action}`, error);
      }
    }
  }
}
```

## Access Control & Authentication

### 1. Privileged Access Management (PAM)

```typescript
// src/security/pam.ts
export class PrivilegedAccessManager {
  async requestAccess(request: AccessRequest) {
    // Validate request
    const validation = await this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid access request: ${validation.reason}`);
    }
    
    // Check if user has permissions
    const hasPermission = await this.checkPermissions(
      request.userId,
      request.resource,
      request.action
    );
    
    if (!hasPermission) {
      await this.logDeniedAccess(request);
      throw new Error('Access denied');
    }
    
    // Generate time-limited credentials
    const credentials = await this.generateTemporaryCredentials({
      userId: request.userId,
      resource: request.resource,
      expiresIn: request.duration || 3600, // 1 hour default
      permissions: request.permissions,
    });
    
    // Log access grant
    await this.logAccessGrant(request, credentials);
    
    // Set up monitoring
    await this.monitorPrivilegedSession(credentials.sessionId);
    
    return credentials;
  }
  
  private async generateTemporaryCredentials(params: any) {
    const sessionId = crypto.randomUUID();
    const token = jwt.sign({
      sessionId,
      userId: params.userId,
      resource: params.resource,
      permissions: params.permissions,
      exp: Math.floor(Date.now() / 1000) + params.expiresIn,
    }, process.env.PAM_SECRET);
    
    // Store session
    await redis.setex(
      `pam:session:${sessionId}`,
      params.expiresIn,
      JSON.stringify({
        ...params,
        startTime: new Date(),
        activities: [],
      })
    );
    
    return { sessionId, token, expiresAt: new Date(Date.now() + params.expiresIn * 1000) };
  }
}
```

### 2. Multi-Factor Authentication (MFA)

```typescript
// src/security/mfa.ts
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export class MFAService {
  async setupMFA(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    
    // Generate secret
    const secret = authenticator.generateSecret();
    
    // Generate QR code
    const otpauth = authenticator.keyuri(
      user.email,
      'Ventry',
      secret
    );
    
    const qrCode = await QRCode.toDataURL(otpauth);
    
    // Store secret (encrypted)
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: await this.encryptSecret(secret),
        mfaEnabled: false, // Enable after verification
      },
    });
    
    return { qrCode, secret };
  }
  
  async verifyMFA(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new Error('MFA not set up');
    
    const secret = await this.decryptSecret(user.mfaSecret);
    const isValid = authenticator.verify({ token, secret });
    
    if (isValid && !user.mfaEnabled) {
      // First successful verification, enable MFA
      await prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
    }
    
    // Log MFA event
    await this.logMFAEvent(userId, isValid ? 'success' : 'failure');
    
    return isValid;
  }
  
  async generateBackupCodes(userId: string) {
    const codes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex')
    );
    
    // Store hashed codes
    const hashedCodes = await Promise.all(
      codes.map(code => bcrypt.hash(code, 10))
    );
    
    await prisma.backupCode.createMany({
      data: hashedCodes.map(hash => ({
        userId,
        code: hash,
        used: false,
      })),
    });
    
    return codes;
  }
}
```

## Compliance & Auditing

### 1. Compliance Monitoring

```typescript
// src/security/compliance.ts
export class ComplianceMonitor {
  private readonly requirements = {
    gdpr: {
      dataRetention: 365 * 2, // 2 years
      consentRequired: true,
      rightToErasure: true,
      dataPortability: true,
    },
    pci: {
      passwordComplexity: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
      sessionTimeout: 15 * 60, // 15 minutes
      encryptionRequired: true,
    },
    sox: {
      auditTrailRetention: 365 * 7, // 7 years
      segregationOfDuties: true,
      changeControl: true,
    },
  };
  
  async auditCompliance() {
    const results = {
      gdpr: await this.auditGDPR(),
      pci: await this.auditPCI(),
      sox: await this.auditSOX(),
      timestamp: new Date(),
    };
    
    // Generate compliance report
    const report = await this.generateComplianceReport(results);
    
    // Store audit results
    await prisma.complianceAudit.create({
      data: {
        results: results as any,
        report: report,
        issues: this.extractIssues(results),
      },
    });
    
    return results;
  }
  
  private async auditGDPR() {
    const checks = {
      dataRetention: await this.checkDataRetention(),
      consentManagement: await this.checkConsentManagement(),
      encryptionAtRest: await this.checkEncryption(),
      accessControls: await this.checkAccessControls(),
      dataSubjectRights: await this.checkDataSubjectRights(),
    };
    
    return {
      compliant: Object.values(checks).every(c => c.passed),
      checks,
    };
  }
  
  private async checkDataRetention() {
    // Check for data older than retention period
    const oldData = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '2 years'
    `;
    
    return {
      passed: oldData[0].count === 0,
      details: `Found ${oldData[0].count} records exceeding retention period`,
    };
  }
}
```

### 2. Security Audit Logging

```typescript
// src/security/audit-logger.ts
export class SecurityAuditLogger {
  async logSecurityEvent(event: SecurityEvent) {
    const enrichedEvent = {
      ...event,
      timestamp: new Date(),
      serverIp: await this.getServerIp(),
      environment: process.env.NODE_ENV,
      sessionId: event.context?.sessionId,
      
      // Hash sensitive data
      userEmail: event.userEmail ? await this.hashPII(event.userEmail) : null,
      
      // Add context
      geoLocation: await this.getGeoLocation(event.clientIp),
      userAgent: this.parseUserAgent(event.userAgent),
      
      // Risk scoring
      riskScore: await this.calculateRiskScore(event),
    };
    
    // Store in database
    await prisma.securityAuditLog.create({
      data: enrichedEvent,
    });
    
    // Send to SIEM
    await this.sendToSIEM(enrichedEvent);
    
    // Check if event requires immediate action
    if (enrichedEvent.riskScore > 80) {
      await this.triggerHighRiskAlert(enrichedEvent);
    }
  }
  
  private async calculateRiskScore(event: SecurityEvent): Promise<number> {
    let score = 0;
    
    // Failed authentication
    if (event.type === 'auth_failed') score += 20;
    
    // Suspicious location
    const location = await this.getGeoLocation(event.clientIp);
    if (location.riskCountry) score += 30;
    
    // Time-based anomaly
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) score += 10;
    
    // Previous incidents from IP
    const previousIncidents = await this.getPreviousIncidents(event.clientIp);
    score += Math.min(previousIncidents * 10, 40);
    
    return Math.min(score, 100);
  }
}
```

## Vulnerability Management

### 1. Dependency Scanning

```yaml
# .github/workflows/security-scan.yml
name: Security Scanning

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 0 * * *' # Daily

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
          
      - name: Run npm audit
        run: |
          npm audit --production
          pnpm audit --production
          
      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'ventry'
          path: '.'
          format: 'HTML'
          
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: reports/
```

### 2. Container Scanning

```dockerfile
# Dockerfile.security-scan
FROM aquasec/trivy:latest

# Scan image for vulnerabilities
RUN trivy image --severity HIGH,CRITICAL \
  --no-progress \
  --format json \
  --output /tmp/scan-results.json \
  ventry-backend:latest

# Fail if critical vulnerabilities found
RUN jq '.Results[].Vulnerabilities[] | select(.Severity == "CRITICAL")' \
  /tmp/scan-results.json && exit 1 || exit 0
```

## Security Metrics & KPIs

### 1. Security Dashboard

```typescript
// src/security/metrics.ts
export class SecurityMetrics {
  async getSecurityKPIs() {
    const [
      incidentMetrics,
      vulnerabilityMetrics,
      complianceMetrics,
      accessMetrics,
    ] = await Promise.all([
      this.getIncidentMetrics(),
      this.getVulnerabilityMetrics(),
      this.getComplianceMetrics(),
      this.getAccessMetrics(),
    ]);
    
    return {
      // Mean Time to Detect (MTTD)
      mttd: incidentMetrics.averageDetectionTime,
      
      // Mean Time to Respond (MTTR)
      mttr: incidentMetrics.averageResponseTime,
      
      // Security incidents
      incidents: {
        total: incidentMetrics.total,
        critical: incidentMetrics.critical,
        resolved: incidentMetrics.resolved,
        trend: incidentMetrics.trend,
      },
      
      // Vulnerabilities
      vulnerabilities: {
        critical: vulnerabilityMetrics.critical,
        high: vulnerabilityMetrics.high,
        patched: vulnerabilityMetrics.patched,
        avgPatchTime: vulnerabilityMetrics.avgPatchTime,
      },
      
      // Compliance
      compliance: {
        score: complianceMetrics.overallScore,
        gdpr: complianceMetrics.gdpr,
        pci: complianceMetrics.pci,
        sox: complianceMetrics.sox,
      },
      
      // Access control
      access: {
        failedLogins: accessMetrics.failedLogins,
        suspiciousActivity: accessMetrics.suspiciousActivity,
        privilegedAccess: accessMetrics.privilegedAccess,
      },
    };
  }
}
```

### 2. Security Reporting

```typescript
// Generate monthly security report
export async function generateSecurityReport() {
  const report = {
    period: {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    },
    
    executive_summary: await generateExecutiveSummary(),
    
    incidents: await getIncidentReport(),
    
    vulnerabilities: await getVulnerabilityReport(),
    
    compliance: await getComplianceReport(),
    
    recommendations: await generateRecommendations(),
  };
  
  // Generate PDF
  const pdf = await generatePDF(report);
  
  // Send to stakeholders
  await sendSecurityReport(pdf, ['security@ventry.com', 'cto@ventry.com']);
  
  return report;
}
```

## Security Operations Checklist

### Daily Tasks
- [ ] Review security alerts and logs
- [ ] Check failed login attempts
- [ ] Monitor vulnerability feeds
- [ ] Verify backup integrity
- [ ] Review access logs

### Weekly Tasks
- [ ] Run vulnerability scans
- [ ] Review user permissions
- [ ] Update security rules
- [ ] Test incident response
- [ ] Security metrics review

### Monthly Tasks
- [ ] Security awareness training
- [ ] Penetration testing
- [ ] Compliance audit
- [ ] Update security policies
- [ ] Review and update playbooks

### Quarterly Tasks
- [ ] Full security assessment
- [ ] Disaster recovery drill
- [ ] Third-party security review
- [ ] Update threat models
- [ ] Executive security briefing

Remember: Security is not a product, but a process. Stay vigilant!