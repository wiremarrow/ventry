-- Add minimal RLS policies for organizations table
-- Production-safe, no test backdoors

-- Ensure RLS is enabled and forced on both tables (idempotent)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;

-- Drop any existing policies for clean slate (defensive)
DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
DROP POLICY IF EXISTS organizations_update_owner ON public.organizations;
DROP POLICY IF EXISTS organizations_create ON public.organizations;
DROP POLICY IF EXISTS organizations_delete_owner ON public.organizations;
DROP POLICY IF EXISTS organizations_view_no_context ON public.organizations;
DROP POLICY IF EXISTS organization_members_view_own ON public.organization_members;
DROP POLICY IF EXISTS organization_members_select_same_org ON public.organization_members;
DROP POLICY IF EXISTS organization_members_no_context ON public.organization_members;

-- Policy 1: Members can view their organizations
CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = public.organizations.id
      AND m.user_id = current_user_id()
    )
  );

-- Policy 2: Owners can update their organizations
CREATE POLICY organizations_update_owner ON public.organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = public.organizations.id
      AND m.user_id = current_user_id()
      AND m.role = 'OWNER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = public.organizations.id
      AND m.user_id = current_user_id()
      AND m.role = 'OWNER'
    )
  );

-- Policy 3: View memberships (own records + same org members)
CREATE POLICY organization_members_view_own ON public.organization_members
  FOR SELECT
  USING (
    -- Can always see your own membership records
    user_id = current_user_id()
    OR
    -- Can see other members in your organizations
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = public.organization_members.organization_id
      AND m.user_id = current_user_id()
    )
  );

-- Add comments explaining the security model
COMMENT ON POLICY organizations_select_member ON public.organizations IS 
'Users can only see organizations they are members of. This ensures tenant isolation.';

COMMENT ON POLICY organizations_update_owner ON public.organizations IS 
'Only organization owners can update organization settings. Both USING and WITH CHECK ensure ownership throughout the transaction.';

COMMENT ON POLICY organization_members_view_own ON public.organization_members IS 
'Users can see their own memberships (for invitations/history) and memberships within their organizations.';