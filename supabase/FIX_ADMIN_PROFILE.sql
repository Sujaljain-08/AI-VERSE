-- =====================================================
-- FIX ADMIN PROFILE ISSUE
-- =====================================================
-- Run this in Supabase SQL Editor to verify and fix admin profile

-- Step 1: Check if auth user exists
SELECT 
  id, 
  email, 
  created_at 
FROM auth.users 
WHERE email = 'admin@test.com';

-- Step 2: Check if profile exists
SELECT 
  id, 
  full_name, 
  role, 
  created_at 
FROM public.profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@test.com');

-- Step 3: If profile doesn't exist, create it manually
-- (Replace the ID with the actual user ID from Step 1)
INSERT INTO public.profiles (id, full_name, role)
SELECT 
  id, 
  'Test Admin', 
  'admin'
FROM auth.users 
WHERE email = 'admin@test.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'admin',
  full_name = 'Test Admin',
  updated_at = NOW();

-- Step 4: Verify the fix
SELECT 
  u.id,
  u.email,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'admin@test.com';

-- Expected result: Should show role = 'admin'

-- =====================================================
-- Also fix student profile if needed
-- =====================================================
INSERT INTO public.profiles (id, full_name, role)
SELECT 
  id, 
  'John Doe', 
  'student'
FROM auth.users 
WHERE email = 'student1@test.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'student',
  full_name = 'John Doe',
  updated_at = NOW();

-- Verify all profiles
SELECT 
  u.email,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email IN ('admin@test.com', 'student1@test.com')
ORDER BY p.role;
