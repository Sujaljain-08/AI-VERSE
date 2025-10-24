# Quick Test Setup Guide

## ✅ What You've Done So Far
- [x] Created database schema (001_initial_schema.sql)
- [x] Created suspicious_snapshots table (002_suspicious_snapshots.sql)

## 🚀 Next Steps to Test Everything

### Step 1: Create Storage Buckets in Supabase
1. Go to **Storage** in Supabase Dashboard
2. Create bucket: `exam-snapshots`
   - Make it **public** or configure RLS policies
3. Create bucket: `exam-recordings` (optional for now)

**Storage RLS Policies:**
```sql
-- Go to Storage > exam-snapshots > Policies

-- Policy 1: Students can upload their own snapshots
CREATE POLICY "Students upload own snapshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exam-snapshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Admins can view all snapshots
CREATE POLICY "Admins view all snapshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-snapshots' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 3: Students can view their own snapshots
CREATE POLICY "Students view own snapshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-snapshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Step 2: Create Test Users in Supabase Auth
1. Go to **Authentication > Users** in Supabase Dashboard
2. Click **Add user** and create:
   - **Admin:** email: `admin@test.com`, password: `Admin@123`
   - **Student 1:** email: `student1@test.com`, password: `Student@123`
   - **Student 2:** email: `student2@test.com`, password: `Student@123`

### Step 3: Set User Roles
After creating users, run this in SQL Editor:

```sql
-- Update the admin role
UPDATE public.profiles 
SET role = 'admin', full_name = 'Test Admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@test.com');

-- Update student roles
UPDATE public.profiles 
SET role = 'student', full_name = 'John Doe'
WHERE id = (SELECT id FROM auth.users WHERE email = 'student1@test.com');

UPDATE public.profiles 
SET role = 'student', full_name = 'Jane Smith'
WHERE id = (SELECT id FROM auth.users WHERE email = 'student2@test.com');
```

### Step 4: Create Mock Exam
Run the seed file in SQL Editor:
```sql
-- Copy and paste content from:
supabase/migrations/003_seed_mock_data.sql
```

This will automatically create a test exam for you!

### Step 5: Get Your Exam ID
```sql
SELECT id, title, start_time, end_time 
FROM public.exams 
ORDER BY created_at DESC 
LIMIT 1;
```

Copy the exam ID - you'll use this to test!

---

## 🧪 Testing Flow

### Terminal 1: Start Python ML Model (Already Running ✅)
```bash
cd model_prediction
python app.py
# Should show: Running on http://localhost:8000
```

### Terminal 2: Start Next.js App
```bash
npm run dev
# Opens on http://localhost:3000
```

### Test Scenario 1: Admin Creates Exam (UI Method)
1. Open browser: `http://localhost:3000`
2. Sign in as: `admin@test.com` / `Admin@123`
3. Click "Create Exam"
4. Fill in:
   - Title: "Test Exam"
   - Duration: 30 minutes
   - Start/End times
5. Click Create

### Test Scenario 2: Student Takes Exam
1. Open **new incognito window**: `http://localhost:3000`
2. Sign in as: `student1@test.com` / `Student@123`
3. Navigate to exam (use exam ID from Step 5)
4. Camera permission will be requested - **Allow it**
5. You should see:
   - Live video feed
   - Focus score updating
   - Status messages

### Test Scenario 3: Admin Monitors Student
1. Back in admin window
2. Go to Admin Dashboard
3. You should see leaderboard with active students
4. Click **"Watch"** button next to student name
5. You should see:
   - Live video stream of student
   - Suspicious snapshots list (if any captured)
   - Connection status

### Test Scenario 4: Trigger Suspicious Behavior
While in student exam window, try these:
- Look away from screen (focus_score drops)
- Cover your face
- Show phone to camera
- Leave the frame entirely

**Expected Results:**
- Focus score should drop below 50
- Snapshot should auto-capture
- Appear in admin's LiveVideoViewer
- Saved to `exam-snapshots` bucket

---

## 🐛 Troubleshooting

### Issue: "WebSocket connection failed"
**Solution:** Make sure Python app is running on port 8000
```bash
cd model_prediction
python app.py
```

### Issue: "Camera permission denied"
**Solution:** 
- Check browser permissions
- Try different browser (Chrome recommended)
- Use localhost (not 127.0.0.1)

### Issue: "Storage bucket not found"
**Solution:** Create `exam-snapshots` bucket in Supabase Storage

### Issue: "No exam sessions showing in admin"
**Solution:** 
- Verify student started exam
- Check network tab for errors
- Verify exam_sessions table has data:
```sql
SELECT * FROM exam_sessions;
```

### Issue: "Live video not connecting"
**Solution:**
- Both users must be on same exam session
- Room ID format: `exam-{sessionId}`
- Check browser console for WebRTC errors
- Try refreshing both windows

---

## 📊 Verify Everything is Working

### Database Checks
```sql
-- Check active sessions
SELECT 
  es.id as session_id,
  p.full_name as student_name,
  e.title as exam_title,
  es.status,
  es.started_at
FROM exam_sessions es
JOIN profiles p ON p.id = es.student_id
JOIN exams e ON e.id = es.exam_id
ORDER BY es.started_at DESC;

-- Check latest cheat scores
SELECT 
  cs.score,
  cs.confidence,
  cs.detected_behavior,
  cs.timestamp,
  p.full_name
FROM cheat_scores cs
JOIN exam_sessions es ON es.id = cs.session_id
JOIN profiles p ON p.id = es.student_id
ORDER BY cs.timestamp DESC
LIMIT 10;

-- Check suspicious snapshots
SELECT 
  ss.id,
  ss.storage_path,
  ss.captured_at,
  p.full_name
FROM suspicious_snapshots ss
JOIN exam_sessions es ON es.id = ss.session_id
JOIN profiles p ON p.id = es.student_id
ORDER BY ss.captured_at DESC;
```

### Storage Checks
1. Go to **Storage > exam-snapshots** in Supabase
2. You should see folders: `{student_id}/{session_id}/`
3. Inside: `{timestamp}.jpg` files

---

## ✨ Success Checklist
- [ ] Storage buckets created
- [ ] Test users created (admin + students)
- [ ] User roles set correctly
- [ ] Mock exam created
- [ ] Python ML model running (port 8000)
- [ ] Next.js app running (port 3000)
- [ ] Student can start exam with camera
- [ ] Admin can see student in leaderboard
- [ ] Admin can click "Watch" and see live video
- [ ] Suspicious snapshots auto-capture when focus < 50
- [ ] Snapshots appear in LiveVideoViewer
- [ ] Snapshots saved to storage bucket

---

## 🎯 Quick Test Command
Once everything is set up, use this URL pattern:
```
Student: http://localhost:3000/exam/{EXAM_ID}
Admin: http://localhost:3000/admin
```

Replace `{EXAM_ID}` with the ID from Step 5!
