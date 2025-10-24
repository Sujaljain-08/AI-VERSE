# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Name**: exam-proctoring
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to you
5. Wait for project to be created (1-2 minutes)

## 2. Get Your Credentials

1. Go to **Project Settings** → **API**
2. Copy the following:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")

## 3. Update Environment Variables

Edit `.env.local` and replace with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Run Database Migration

1. Go to **SQL Editor** in Supabase dashboard
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL editor
5. Click "Run" button

This will create:
- ✅ `profiles` table (extends auth.users)
- ✅ `exams` table
- ✅ `exam_sessions` table
- ✅ `cheat_scores` table
- ✅ `video_metadata` table
- ✅ Row Level Security policies
- ✅ Automatic profile creation on signup

## 5. Enable Google OAuth (Optional)

1. Go to **Authentication** → **Providers**
2. Enable **Google** provider
3. Follow instructions to set up OAuth consent screen
4. Add authorized redirect URLs:
   - `http://localhost:3000/auth/callback` (development)
   - Your production URL + `/auth/callback`

## 6. Create Storage Bucket for Videos

1. Go to **Storage**
2. Click "New bucket"
3. Create bucket named: `exam-videos`
4. Make it **private** (not public)
5. Set up storage policies:

```sql
-- Allow authenticated users to upload their videos
CREATE POLICY "Students can upload their videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exam-videos');

-- Allow users to view their own videos
CREATE POLICY "Students can view their videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'exam-videos');

-- Allow admins to view all videos
CREATE POLICY "Admins can view all videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-videos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

## 7. Enable Realtime (for Leaderboard)

1. Go to **Database** → **Replication**
2. Enable replication for these tables:
   - ✅ `cheat_scores`
   - ✅ `exam_sessions`

## 8. Test the Setup

1. Restart your Next.js dev server: `npm run dev`
2. Go to `http://localhost:3000`
3. Sign up with a test account
4. You should be redirected to `/dashboard`

## 9. Create Admin User

To promote a user to admin:

1. Go to **SQL Editor** in Supabase
2. Run this query (replace with your user's email):

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'your-email@example.com'
);
```

3. Log out and log back in
4. You'll be redirected to `/admin` dashboard

## Database Schema

```
auth.users (Supabase managed)
  └─ profiles (role: student/admin)
       ├─ exams (created by admin)
       │    └─ exam_sessions (student taking exam)
       │         ├─ cheat_scores (AI detection results)
       │         └─ video_metadata (video recordings)
```

## Next Steps

✅ Authentication is complete!
✅ Database schema is ready!
✅ Role-based access control is set up!

You can now:
- Build the admin dashboard UI
- Build the student dashboard UI
- Create the leaderboard component
- Add real-time subscriptions
