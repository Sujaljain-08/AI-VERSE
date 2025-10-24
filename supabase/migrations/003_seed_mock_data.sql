-- =====================================================
-- SEED DATA FOR TESTING EXAM MONITORING SYSTEM
-- =====================================================
-- This creates mock admin, students, and a test exam
-- Run this in Supabase SQL Editor after running migrations 001 and 002

-- NOTE: You'll need to create these users in Supabase Auth first, then update the UUIDs below
-- For now, we'll use placeholder UUIDs that you can replace with actual auth.users IDs

-- =====================================================
-- STEP 1: Create test profiles (after creating auth users)
-- =====================================================
-- First, go to Authentication > Users in Supabase Dashboard and create:
-- 1. admin@test.com (password: Admin@123)
-- 2. student1@test.com (password: Student@123)
-- 3. student2@test.com (password: Student@123)
-- 4. student3@test.com (password: Student@123)

-- Then get their UUIDs and insert profiles:
-- Replace these UUIDs with actual ones from auth.users
-- INSERT INTO public.profiles (id, full_name, role) VALUES
--   ('ADMIN_UUID_HERE', 'Test Admin', 'admin'),
--   ('STUDENT1_UUID_HERE', 'John Doe', 'student'),
--   ('STUDENT2_UUID_HERE', 'Jane Smith', 'student'),
--   ('STUDENT3_UUID_HERE', 'Mike Johnson', 'student');

-- =====================================================
-- STEP 2: Create a test exam
-- =====================================================
-- Replace ADMIN_UUID_HERE with your actual admin UUID
-- INSERT INTO public.exams (id, title, description, duration_minutes, start_time, end_time, created_by) VALUES
--   (
--     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--     'Mock Final Exam - Computer Science',
--     'This is a test exam for the proctoring system. Students will be monitored for suspicious behavior.',
--     60,
--     NOW(),
--     NOW() + INTERVAL '2 hours',
--     'ADMIN_UUID_HERE'
--   );

-- =====================================================
-- ALTERNATIVE: Use this query to auto-create exam for existing admin
-- =====================================================
-- This will work if you already have an admin in the database
DO $$
DECLARE
  admin_uuid UUID;
  exam_uuid UUID;
BEGIN
  -- Get the first admin user
  SELECT id INTO admin_uuid FROM public.profiles WHERE role = 'admin' LIMIT 1;
  
  IF admin_uuid IS NOT NULL THEN
    -- Create a test exam
    exam_uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    
    INSERT INTO public.exams (id, title, description, duration_minutes, start_time, end_time, created_by)
    VALUES (
      exam_uuid,
      'Mock Final Exam - Computer Science',
      'This is a comprehensive test exam for the AI-powered proctoring system. Students will be monitored in real-time for suspicious behaviors including looking away, multiple faces, phone usage, and loss of focus.',
      60,
      NOW(),
      NOW() + INTERVAL '2 hours',
      admin_uuid
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time;
    
    RAISE NOTICE 'Test exam created with ID: %', exam_uuid;
  ELSE
    RAISE NOTICE 'No admin found. Please create an admin user first.';
  END IF;
END $$;

-- =====================================================
-- STEP 3: Verify the data
-- =====================================================
-- Run these queries to check if everything is set up:

-- Check profiles
SELECT id, full_name, role, created_at FROM public.profiles ORDER BY role, created_at;

-- Check exams
SELECT id, title, duration_minutes, start_time, end_time, created_by FROM public.exams;

-- Check if exam sessions will be created (should be empty until students start)
SELECT * FROM public.exam_sessions;

-- =====================================================
-- HELPFUL QUERIES FOR TESTING
-- =====================================================

-- Get exam ID for testing (copy this ID to use in your app)
-- SELECT id, title FROM public.exams LIMIT 1;

-- Manually create a test session (optional - usually auto-created by app)
-- Replace EXAM_ID and STUDENT_ID with actual UUIDs
-- INSERT INTO public.exam_sessions (exam_id, student_id, status)
-- VALUES ('EXAM_ID_HERE', 'STUDENT_ID_HERE', 'in_progress');

-- Clean up test data if needed
-- DELETE FROM public.cheat_scores;
-- DELETE FROM public.suspicious_snapshots;
-- DELETE FROM public.exam_sessions;
-- DELETE FROM public.exams;
