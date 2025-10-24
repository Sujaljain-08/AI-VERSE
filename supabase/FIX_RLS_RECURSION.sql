-- =====================================================
-- FIX INFINITE RECURSION IN PROFILES RLS POLICIES
-- =====================================================
-- The "Admins can view all profiles" policy causes infinite recursion
-- because it queries profiles table to check if user is admin
-- while trying to access the profiles table!

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Step 2: Recreate it without recursion using auth.jwt()
-- This checks the role directly from the JWT token metadata
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR 
    (auth.jwt() ->> 'role')::text = 'admin'
  );

-- Alternative: If role is not in JWT, we need to allow self-read first
-- Then use a function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate using the function (BETTER SOLUTION)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR 
    public.is_admin()
  );

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
