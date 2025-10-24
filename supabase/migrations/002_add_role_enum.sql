-- Create ENUM type for user roles
CREATE TYPE user_role AS ENUM ('student', 'admin');

-- Alter the profiles table to use the ENUM type
ALTER TABLE public.profiles 
  ALTER COLUMN role TYPE user_role USING role::user_role,
  ALTER COLUMN role SET DEFAULT 'student'::user_role;
