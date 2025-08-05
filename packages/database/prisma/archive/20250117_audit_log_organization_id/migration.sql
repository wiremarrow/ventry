-- Update existing audit logs to have organizationId based on user's current organization
-- This assumes users are only in one organization currently
UPDATE audit_logs 
SET organization_id = (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = audit_logs.user_id 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Make organizationId non-nullable
ALTER TABLE audit_logs 
ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE audit_logs
ADD CONSTRAINT "audit_logs_organization_id_fkey" 
FOREIGN KEY ("organization_id") 
REFERENCES "organizations"("id") 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");