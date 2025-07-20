-- Fix infinite recursion in organization_members policy
-- The previous policy had a self-referential EXISTS clause that caused infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS organization_members_view_own ON public.organization_members;

-- For now, create a simple policy that only allows users to see their own memberships
-- This avoids the recursion issue while still providing basic functionality
CREATE POLICY organization_members_view_own ON public.organization_members
  FOR SELECT
  USING (user_id = current_user_id());

-- TODO: In the future, we can add a more sophisticated policy that allows
-- viewing other members in the same organization without causing recursion,
-- possibly using a security definer function or materialized view

COMMENT ON POLICY organization_members_view_own ON public.organization_members IS 
'Simplified policy: Users can only see their own membership records. Avoids recursion issues.';