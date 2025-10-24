# Testing the Dashboards

## ✅ What's Been Built

### **Admin Dashboard** (`/admin`)
- ✅ Real-time cheat detection leaderboard
- ✅ Students ranked by cheat probability score
- ✅ Click on any student to view live video (placeholder UI)
- ✅ Filter exams dropdown
- ✅ Live updates using Supabase realtime
- ✅ Stats cards (active sessions, high risk, total exams)

### **Student Dashboard** (`/dashboard`)
- ✅ View available exams
- ✅ See exam details (title, description, start time, duration)
- ✅ Live/Upcoming/Ended status badges
- ✅ Start exam button (when active)
- ✅ Completed exams tab (placeholder)

### **Role-Based Access**
- ✅ Students can only access `/dashboard`
- ✅ Admins can only access `/admin`
- ✅ Role checked from `profiles` table in database
- ✅ Automatic redirection based on role

---

## 🧪 How to Test

### 1. **Create Test Accounts**

Sign up two accounts:

1. **Student Account**
   - Go to: http://localhost:3001/signup
   - Create account (defaults to student role)

2. **Admin Account**
   - Go to: http://localhost:3001/signup
   - Create another account
   - **Promote to admin** (see below)

### 2. **Promote User to Admin**

Go to Supabase Dashboard → SQL Editor and run:

\`\`\`sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'your-admin-email@example.com'
);
\`\`\`

Log out and log back in.

### 3. **Test Student Dashboard**

1. Sign in with student account
2. You'll be redirected to `/dashboard`
3. View: Available exams list (empty for now)
4. Try accessing `/admin` - should redirect back to `/dashboard`

### 4. **Test Admin Dashboard**

1. Sign in with admin account
2. You'll be redirected to `/admin`
3. See: Real-time leaderboard (empty until students take exams)
4. Click filter dropdown to filter by exam
5. Try accessing `/dashboard` - you'll stay on admin

### 5. **Add Test Exam (Optional)**

To see exams appear in student dashboard:

\`\`\`sql
INSERT INTO public.exams (title, description, duration_minutes, start_time, end_time, created_by)
VALUES (
  'Sample Exam',
  'This is a test exam',
  60,
  NOW(),
  NOW() + INTERVAL '2 hours',
  (SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com')
);
\`\`\`

### 6. **Simulate Cheat Scores (For Leaderboard)**

To test the leaderboard with mock data:

\`\`\`sql
-- Create a mock exam session
INSERT INTO public.exam_sessions (exam_id, student_id, status)
VALUES (
  (SELECT id FROM public.exams LIMIT 1),
  (SELECT id FROM auth.users WHERE email = 'student@example.com'),
  'in_progress'
);

-- Add mock cheat score
INSERT INTO public.cheat_scores (session_id, score, confidence, detected_behavior)
VALUES (
  (SELECT id FROM public.exam_sessions LIMIT 1),
  75.5,
  90.2,
  '["Looking away", "Multiple faces detected"]'::jsonb
);
\`\`\`

The leaderboard should update in real-time!

---

## 🎯 Key Features

### **Admin Features:**
- 📊 Real-time leaderboard with auto-refresh
- 🎥 Click student to open video player modal
- 🚨 Color-coded risk levels (red = high, green = low)
- 🔍 Filter by specific exam
- 📈 Stats dashboard

### **Student Features:**
- 📝 View all scheduled exams
- ⏰ See start times and duration
- 🟢 Live status indicator for active exams
- 🔴 Disabled buttons for upcoming/ended exams

### **Video Player:**
- 📹 Modal popup when clicking student
- 🎬 Placeholder for live stream (backend integration pending)
- 🚩 Flag session button
- 📸 Screenshot button (UI ready)

---

## 🛠️ Next Steps

Backend integration needed for:
1. Video streaming from student cameras
2. AI model for cheat detection
3. Actual exam questions/forms
4. Results and analytics

Frontend is **100% ready** for backend integration!
