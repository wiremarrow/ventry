# Error Codes Reference

Comprehensive list of all error codes used in Ventry, their meanings, and resolution steps.

## Error Code Format

Ventry uses a structured error code format: `[CATEGORY][NUMBER]`

- **Category**: 3-letter code indicating the error domain
- **Number**: 3-digit number for specific error

Example: `AUTH001` - Authentication error #001

## Error Categories

| Category       | Code | Description                   |
| -------------- | ---- | ----------------------------- |
| Authentication | AUTH | Login, tokens, sessions       |
| Authorization  | AUT  | Permissions, access control   |
| Validation     | VAL  | Input validation, data format |
| Business Logic | BIZ  | Business rules, constraints   |
| Inventory      | INV  | Stock, movements, locations   |
| Orders         | ORD  | Sales, purchase orders        |
| Organization   | ORG  | Multi-tenant, membership      |
| System         | SYS  | Server, infrastructure        |
| Database       | DB   | Database operations           |
| External       | EXT  | Third-party services          |

## Authentication Errors (AUTH)

### AUTH001 - Invalid Credentials

- **Message**: "Invalid email or password"
- **HTTP Status**: 401
- **Cause**: Incorrect login credentials
- **Resolution**:
  - Verify email address is correct
  - Check password (case-sensitive)
  - Use password reset if forgotten

### AUTH002 - Token Expired

- **Message**: "Authentication token has expired"
- **HTTP Status**: 401
- **Cause**: JWT token past expiration time
- **Resolution**:
  - Log in again to get new token
  - Implement token refresh logic
  - Check system time synchronization

### AUTH003 - Invalid Token

- **Message**: "Invalid authentication token"
- **HTTP Status**: 401
- **Cause**: Malformed or tampered token
- **Resolution**:
  - Clear cookies and log in again
  - Check token format
  - Verify JWT secret is correct

### AUTH004 - Account Locked

- **Message**: "Account has been locked due to multiple failed login attempts"
- **HTTP Status**: 403
- **Cause**: Too many failed login attempts
- **Resolution**:
  - Wait for lockout period (30 minutes)
  - Contact administrator to unlock
  - Use password reset

### AUTH005 - Account Suspended

- **Message**: "Account has been suspended"
- **HTTP Status**: 403
- **Cause**: Administrative action or payment issue
- **Resolution**:
  - Contact support
  - Check payment status
  - Review terms of service

### AUTH006 - Two-Factor Required (Reserved)

- **Message**: "Two-factor authentication is required"
- **HTTP Status**: 428
- **Note**: This error code is reserved for future 2FA implementation
- **Cause**: 2FA enabled but not provided (not yet implemented)
- **Resolution**:
  - Enter 2FA code from authenticator
  - Use backup code if available
  - Contact admin if device lost

### AUTH007 - Invalid Session

- **Message**: "Session is invalid or has expired"
- **HTTP Status**: 401
- **Cause**: Session timeout or invalidation
- **Resolution**:
  - Log in again
  - Check session timeout settings
  - Verify cookies are enabled

## Authorization Errors (AUT)

### AUT001 - Insufficient Permissions

- **Message**: "You do not have permission to perform this action"
- **HTTP Status**: 403
- **Cause**: User role lacks required permission
- **Resolution**:
  - Contact organization admin
  - Request permission upgrade
  - Verify correct organization context

### AUT002 - Resource Access Denied

- **Message**: "Access denied to requested resource"
- **HTTP Status**: 403
- **Cause**: Resource belongs to different organization
- **Resolution**:
  - Verify organization context
  - Check resource ownership
  - Request access from owner

### AUT003 - Feature Not Available

- **Message**: "This feature is not available in your plan"
- **HTTP Status**: 403
- **Cause**: Feature requires plan upgrade
- **Resolution**:
  - Upgrade subscription plan
  - Contact sales for access
  - Use alternative features

### AUT004 - API Access Disabled

- **Message**: "API access is not enabled for this organization"
- **HTTP Status**: 403
- **Cause**: API feature not enabled
- **Resolution**:
  - Enable API access in settings
  - Upgrade to plan with API access
  - Contact support

## Validation Errors (VAL)

### VAL001 - Missing Required Field

- **Message**: "Required field '{field}' is missing"
- **HTTP Status**: 422
- **Cause**: Required input not provided
- **Resolution**:
  - Provide all required fields
  - Check API documentation
  - Verify request format

### VAL002 - Invalid Field Format

- **Message**: "Field '{field}' has invalid format"
- **HTTP Status**: 422
- **Cause**: Data doesn't match expected format
- **Resolution**:
  - Check field format requirements
  - Use correct data types
  - Validate before submission

### VAL003 - Value Out of Range

- **Message**: "Value {value} is outside allowed range {min}-{max}"
- **HTTP Status**: 422
- **Cause**: Numeric value exceeds limits
- **Resolution**:
  - Use value within allowed range
  - Check business rules
  - Verify unit of measure

### VAL004 - Invalid Email Format

- **Message**: "Email address is not valid"
- **HTTP Status**: 422
- **Cause**: Email doesn't match pattern
- **Resolution**:
  - Use valid email format
  - Remove special characters
  - Check for typos

### VAL005 - Duplicate Value

- **Message**: "Value already exists: {field}"
- **HTTP Status**: 409
- **Cause**: Unique constraint violation
- **Resolution**:
  - Use different value
  - Check existing records
  - Add unique suffix

## Business Logic Errors (BIZ)

### BIZ001 - Invalid State Transition

- **Message**: "Cannot transition from {current} to {target} state"
- **HTTP Status**: 422
- **Cause**: Invalid workflow transition
- **Resolution**:
  - Follow correct workflow
  - Check current state
  - Review state machine rules

### BIZ002 - Business Rule Violation

- **Message**: "Operation violates business rule: {rule}"
- **HTTP Status**: 422
- **Cause**: Custom business rule failed
- **Resolution**:
  - Review business rules
  - Adjust operation parameters
  - Contact administrator

### BIZ003 - Approval Required

- **Message**: "This operation requires approval"
- **HTTP Status**: 422
- **Cause**: Exceeds approval threshold
- **Resolution**:
  - Submit for approval
  - Contact approver
  - Reduce amount below threshold

### BIZ004 - Budget Exceeded

- **Message**: "Operation would exceed budget limit"
- **HTTP Status**: 422
- **Cause**: Insufficient budget allocation
- **Resolution**:
  - Request budget increase
  - Wait for new period
  - Reduce order amount

## Inventory Errors (INV)

### INV001 - Insufficient Stock

- **Message**: "Insufficient stock available. Required: {required}, Available: {available}"
- **HTTP Status**: 409
- **Cause**: Not enough inventory
- **Resolution**:
  - Reduce quantity
  - Check other locations
  - Create purchase order
  - Enable backorders

### INV002 - Item Not Found

- **Message**: "Item {sku} not found"
- **HTTP Status**: 404
- **Cause**: Invalid item reference
- **Resolution**:
  - Verify SKU/ID
  - Check item status
  - Search by name

### INV003 - Location Not Found

- **Message**: "Location {location} not found"
- **HTTP Status**: 404
- **Cause**: Invalid location reference
- **Resolution**:
  - Verify location code
  - Check warehouse
  - Create location first

### INV004 - Negative Stock Not Allowed

- **Message**: "Operation would result in negative stock"
- **HTTP Status**: 422
- **Cause**: Stock would go below zero
- **Resolution**:
  - Enable negative stock in settings
  - Adjust quantity
  - Receive stock first

### INV005 - Item Already Exists

- **Message**: "Item with SKU {sku} already exists"
- **HTTP Status**: 409
- **Cause**: Duplicate SKU
- **Resolution**:
  - Use different SKU
  - Update existing item
  - Check for typos

### INV006 - Cycle Count Mismatch

- **Message**: "Cycle count variance exceeds threshold"
- **HTTP Status**: 422
- **Cause**: Large inventory adjustment
- **Resolution**:
  - Verify count accuracy
  - Get supervisor approval
  - Document reason

### INV007 - Serial Number Duplicate

- **Message**: "Serial number {serial} already exists"
- **HTTP Status**: 409
- **Cause**: Duplicate serial number
- **Resolution**:
  - Verify serial number
  - Check existing records
  - Use unique serial

### INV008 - Lot Expired

- **Message**: "Lot {lot} has expired"
- **HTTP Status**: 422
- **Cause**: Using expired inventory
- **Resolution**:
  - Use different lot
  - Update expiry date
  - Dispose of expired stock

## Order Errors (ORD)

### ORD001 - Order Not Found

- **Message**: "Order {orderId} not found"
- **HTTP Status**: 404
- **Cause**: Invalid order reference
- **Resolution**:
  - Verify order number
  - Check order status
  - Search by customer

### ORD002 - Cannot Modify Order

- **Message**: "Order cannot be modified in {status} status"
- **HTTP Status**: 422
- **Cause**: Order in final state
- **Resolution**:
  - Create new order
  - Cancel and recreate
  - Contact support

### ORD003 - Customer Credit Limit

- **Message**: "Order exceeds customer credit limit"
- **HTTP Status**: 422
- **Cause**: Insufficient credit
- **Resolution**:
  - Request payment
  - Increase credit limit
  - Reduce order value

### ORD004 - Minimum Order Value

- **Message**: "Order value {value} below minimum {minimum}"
- **HTTP Status**: 422
- **Cause**: Order too small
- **Resolution**:
  - Add more items
  - Meet minimum value
  - Request exception

### ORD005 - Shipping Address Invalid

- **Message**: "Shipping address is incomplete or invalid"
- **HTTP Status**: 422
- **Cause**: Address validation failed
- **Resolution**:
  - Verify address details
  - Use address validation
  - Check postal code

### ORD006 - Payment Failed

- **Message**: "Payment processing failed"
- **HTTP Status**: 422
- **Cause**: Payment gateway error
- **Resolution**:
  - Retry payment
  - Use different method
  - Check payment details

## Organization Errors (ORG)

### ORG001 - Organization Not Found

- **Message**: "Organization not found"
- **HTTP Status**: 404
- **Cause**: Invalid organization ID
- **Resolution**:
  - Verify organization exists
  - Check membership
  - Switch organization

### ORG002 - Not Organization Member

- **Message**: "You are not a member of this organization"
- **HTTP Status**: 403
- **Cause**: No membership record
- **Resolution**:
  - Request invitation
  - Check invitation email
  - Contact admin

### ORG003 - Organization Suspended

- **Message**: "Organization has been suspended"
- **HTTP Status**: 403
- **Cause**: Billing or policy issue
- **Resolution**:
  - Contact billing
  - Review account status
  - Update payment method

### ORG004 - Member Limit Reached

- **Message**: "Organization has reached member limit"
- **HTTP Status**: 422
- **Cause**: Plan member limit
- **Resolution**:
  - Upgrade plan
  - Remove inactive members
  - Contact sales

### ORG005 - Cannot Leave Organization

- **Message**: "Cannot leave organization as sole owner"
- **HTTP Status**: 422
- **Cause**: Last owner attempting to leave
- **Resolution**:
  - Transfer ownership first
  - Add another owner
  - Delete organization

## System Errors (SYS)

### SYS001 - Internal Server Error

- **Message**: "An unexpected error occurred"
- **HTTP Status**: 500
- **Cause**: Unhandled exception
- **Resolution**:
  - Retry operation
  - Contact support
  - Check status page

### SYS002 - Service Unavailable

- **Message**: "Service temporarily unavailable"
- **HTTP Status**: 503
- **Cause**: Maintenance or overload
- **Resolution**:
  - Wait and retry
  - Check maintenance schedule
  - Use different region

### SYS003 - Rate Limit Exceeded

- **Message**: "Too many requests. Please try again later"
- **HTTP Status**: 429
- **Cause**: API rate limit hit
- **Resolution**:
  - Wait for rate limit reset
  - Reduce request frequency
  - Upgrade plan for higher limits

### SYS004 - Request Timeout

- **Message**: "Request processing timed out"
- **HTTP Status**: 504
- **Cause**: Long-running operation
- **Resolution**:
  - Retry with smaller batch
  - Use async processing
  - Optimize query

### SYS005 - File Too Large

- **Message**: "File size exceeds maximum allowed size of {max}"
- **HTTP Status**: 413
- **Cause**: Upload size limit
- **Resolution**:
  - Reduce file size
  - Compress file
  - Use chunked upload

## Database Errors (DB)

### DB001 - Connection Failed

- **Message**: "Failed to connect to database"
- **HTTP Status**: 503
- **Cause**: Database unavailable
- **Resolution**:
  - Check database status
  - Verify credentials
  - Check network

### DB002 - Query Timeout

- **Message**: "Database query timed out"
- **HTTP Status**: 504
- **Cause**: Slow query execution
- **Resolution**:
  - Optimize query
  - Add indexes
  - Reduce data set

### DB003 - Constraint Violation

- **Message**: "Database constraint violation: {constraint}"
- **HTTP Status**: 409
- **Cause**: Foreign key or check constraint
- **Resolution**:
  - Check related records
  - Fix data relationships
  - Review constraints

### DB004 - Deadlock Detected

- **Message**: "Database deadlock detected"
- **HTTP Status**: 409
- **Cause**: Concurrent transactions
- **Resolution**:
  - Retry operation
  - Review transaction order
  - Reduce lock scope

## External Service Errors (EXT)

### EXT001 - Email Service Error

- **Message**: "Failed to send email"
- **HTTP Status**: 502
- **Cause**: SMTP service error
- **Resolution**:
  - Check email config
  - Verify SMTP credentials
  - Use backup service

### EXT002 - Storage Service Error

- **Message**: "Failed to access storage service"
- **HTTP Status**: 502
- **Cause**: S3/storage unavailable
- **Resolution**:
  - Check storage config
  - Verify permissions
  - Use local fallback

### EXT003 - Payment Gateway Error

- **Message**: "Payment gateway communication error"
- **HTTP Status**: 502
- **Cause**: Gateway unavailable
- **Resolution**:
  - Retry payment
  - Check gateway status
  - Use alternate gateway

### EXT004 - SMS Service Error

- **Message**: "Failed to send SMS"
- **HTTP Status**: 502
- **Cause**: SMS provider error
- **Resolution**:
  - Check SMS credits
  - Verify phone number
  - Use email fallback

## Error Response Format

### Standard Error Response

```json
{
  "error": {
    "code": "INV001",
    "message": "Insufficient stock available",
    "details": {
      "itemId": "itm_123",
      "requested": 100,
      "available": 50,
      "locations": ["loc_456", "loc_789"]
    },
    "userMessage": "Not enough stock. Only 50 units available.",
    "timestamp": "2024-01-20T10:30:00Z",
    "requestId": "req_abc123",
    "documentation": "https://docs.ventry.app/errors/INV001"
  }
}
```

### Validation Error Response

```json
{
  "error": {
    "code": "VAL001",
    "message": "Validation failed",
    "errors": [
      {
        "field": "email",
        "code": "VAL004",
        "message": "Invalid email format"
      },
      {
        "field": "quantity",
        "code": "VAL003",
        "message": "Value must be between 1 and 1000"
      }
    ],
    "timestamp": "2024-01-20T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## Error Handling Best Practices

### Client-Side Handling

```typescript
try {
  const result = await api.createOrder(orderData);
} catch (error) {
  if (error.code === 'INV001') {
    // Show specific message for insufficient stock
    showStockError(error.details);
  } else if (error.code.startsWith('VAL')) {
    // Show validation errors
    showValidationErrors(error.errors);
  } else {
    // Generic error handling
    showGenericError(error.userMessage || 'An error occurred');
  }

  // Log for debugging
  console.error(`Error ${error.code}:`, error);
}
```

### Server-Side Handling

```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

// Usage
throw new AppError('INV001', 'Insufficient stock available', 409, {
  itemId: item.id,
  requested: quantity,
  available: stock.available,
});
```

## Monitoring and Alerting

### Error Tracking

Monitor these error patterns:

- Sudden increase in specific error codes
- New error codes appearing
- Error rate by endpoint
- Error distribution by organization

### Alert Thresholds

- **Critical**: >10% error rate for 5 minutes
- **Warning**: >5% error rate for 10 minutes
- **Info**: New error code detected

## Troubleshooting Guide

### By Symptom

1. **"Cannot login"**
   - Check AUTH001, AUTH002, AUTH004
   - Verify credentials
   - Check account status

2. **"Cannot create order"**
   - Check INV001, ORD003, VAL001
   - Verify stock levels
   - Check validation

3. **"Access denied"**
   - Check AUT001, ORG002
   - Verify permissions
   - Check organization

4. **"Operation failed"**
   - Check SYS001, DB001
   - Review logs
   - Contact support

## Next Steps

1. Implement error handling in your application
2. Set up error monitoring
3. Create user-friendly error messages
4. Document custom error codes
5. Test error scenarios
