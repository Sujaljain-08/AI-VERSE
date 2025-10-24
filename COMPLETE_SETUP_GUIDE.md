# 🚀 Complete Setup & Testing Guide

## ✅ **System Overview**

You now have a **unified exam monitoring system** with:
- ✅ **WebSocket ML Detection** - Automated cheat scoring (Python FastAPI)
- ✅ **WebRTC Live Streaming** - Admin can watch students in real-time
- ✅ **Suspicious Snapshots** - Auto-saved when focus_score < 50
- ✅ **Real-time Leaderboard** - Students ranked by cheat risk
- ✅ **Admin Dashboard** - Click student → Watch live + view snapshots

---

## 📋 **Prerequisites**

### **1. Database Setup (Supabase)**

Run the new migration for suspicious snapshots:

```sql
-- Go to Supabase Dashboard → SQL Editor
-- Run: supabase/migrations/002_suspicious_snapshots.sql
```

### **2. Storage Buckets** 

Create **TWO** storage buckets in Supabase:

#### **Bucket 1: `exam-snapshots`**
```
Name: exam-snapshots
Public: false (private)
File size limit: 10 MB
Allowed MIME types: image/jpeg, image/png
```

**RLS Policies:**
```sql
-- Students upload their own snapshots
CREATE POLICY "Students can upload snapshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exam-snapshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins view all snapshots
CREATE POLICY "Admins can view all snapshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-snapshots' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

#### **Bucket 2: `exam-recordings`** (optional for 10s video clips)
Same policies as above.

---

## 🧪 **Testing Steps**

### **Step 1: Start Python ML Model**

```powershell
# Already done! Your terminal should show:
cd model_prediction
.venv\Scripts\activate
python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload

# You should see:
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### **Step 2: Start Next.js Dev Server**

Open a **NEW terminal**:

```powershell
npm run dev

# You should see:
▲ Next.js 14.2.15
- Local:        http://localhost:3000
- Ready in X ms
```

### **Step 3: Create Test Exam (Admin)**

1. Login as admin: `http://localhost:3000/login`
2. Create an exam at: `http://localhost:3000/admin`
   - Title: "Mock Test 1"
   - Duration: 60 minutes
   - Start time: Now
   - End time: +1 hour

### **Step 4: Take Exam (Student)**

Open **NEW browser/incognito** window:

1. Go to: `http://localhost:3000/login`
2. Login as student
3. Go to: `http://localhost:3000/dashboard`
4. Click "Start Exam" on "Mock Test 1"
5. Allow camera access
6. Click **"▶️ Start Exam"**

**You should see:**
- ✅ Webcam feed active
- ✅ Focus score updating (0-100%)
- ✅ ML model analyzing in real-time
- ✅ Alerts appearing when looking away

### **Step 5: Monitor as Admin**

Switch back to admin window:

1. Go to: `http://localhost:3000/admin`
2. You should see:
   - ✅ **Real-time leaderboard** with student
   - ✅ **Cheat score** updating live
   - ✅ Student name, exam, and risk level

3. **Click on the student row**
4. Live Video Viewer modal opens:
   - ✅ **Live video feed** from student's camera
   - ✅ **Suspicious snapshots** list (if any)
   - ✅ Connection status (🔴 Live)

### **Step 6: Trigger Suspicious Behavior**

In the student window, try these to test detection:

1. **Look away** (left/right) → Score drops
2. **Look up** (at ceiling) → Alerts: "looking_up_copying"
3. **Move face out of frame** → Alerts: "no_face"
4. **Look down** → Alerts: "looking_down"
5. **Stay away 5+ seconds** → Alerts: "away_5_seconds"

**Watch admin dashboard:**
- ✅ Cheat score increases (real-time)
- ✅ Student moves up leaderboard
- ✅ Snapshots appear in Live Video Viewer

---

## 🎯 **Expected Behavior**

### **Student View (`/exam/[id]`)**
```
┌─────────────────────────────────────────┐
│  Webcam Preview (640x480)               │
│  ┌─────────────────────────────────┐   │
│  │     [Your Face Here]            │   │
│  │                                 │   │
│  │  Focus Score: 85%               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Status: >> FOCUSED ON SCREEN           │
│  Alerts: (none)                         │
│                                         │
│  [Submit Exam]                          │
└─────────────────────────────────────────┘
```

### **Admin View (`/admin`)**
```
┌─────────────────────────────────────────────────────────┐
│  Cheat Detection Leaderboard        [Live Updates 🟢]  │
├─────────────────────────────────────────────────────────┤
│  Rank  Student          Exam       Cheat Score  Action  │
│  1     John Doe        Mock Test   75% 🔴      [Watch]  │
│  2     Jane Smith      Mock Test   45% 🟡      [Watch]  │
│  3     Bob Wilson      Mock Test   15% 🟢      [Watch]  │
└─────────────────────────────────────────────────────────┘

Click [Watch] → Opens Live Video Viewer:
┌───────────────────────────────────────────────────────┐
│  Live Monitoring - John Doe                    [×]    │
├───────────────────────────────────────────────────────┤
│  ┌──────────────────┐  │ 📸 Snapshots (5)           │
│  │  [Live Video]    │  │ ┌─────────────────────┐   │
│  │                  │  │ │ 12:34 PM            │   │
│  │  🔴 Live         │  │ │ Looking away        │   │
│  │                  │  │ └─────────────────────┘   │
│  └──────────────────┘  │ ┌─────────────────────┐   │
│                        │ │ 12:36 PM            │   │
│                        │ │ No face detected    │   │
│                        │ └─────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

---

## 🐛 **Troubleshooting**

### **Issue 1: "Connection error - Make sure ML model is running"**
**Solution:**
```powershell
# Check if Python API is running:
curl http://localhost:8000/health

# Should return:
{"status":"healthy","monitor_initialized":true,"timestamp":...}

# If not, restart:
cd model_prediction
.venv\Scripts\activate
python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### **Issue 2: "Failed to access webcam"**
**Solution:**
- Allow camera permissions in browser
- Check if camera is being used by another app
- Try different browser (Chrome recommended)

### **Issue 3: "Live video not connecting"**
**Solution:**
- Check Supabase Realtime is enabled
- Verify student started exam first
- Check browser console for WebRTC errors
- Try refreshing admin dashboard

### **Issue 4: "Snapshots not saving"**
**Solution:**
- Create `exam-snapshots` bucket in Supabase Storage
- Apply RLS policies (see above)
- Check browser console for storage errors

### **Issue 5: "Leaderboard not updating"**
**Solution:**
- Verify student is actively taking exam
- Check Supabase real-time subscriptions enabled
- Refresh admin dashboard
- Check `cheat_scores` table has data

---

## 📊 **Performance Testing**

### **Simulate Multiple Students:**

Open multiple browser tabs/windows:
```
Tab 1: Student A (http://localhost:3000/exam/[exam-id])
Tab 2: Student B (new incognito)
Tab 3: Student C (new incognito)
Tab 4: Admin Dashboard (http://localhost:3000/admin)
```

**Monitor:**
- CPU usage (should be < 50% for 3 students)
- Leaderboard updates in real-time
- Live video switches between students

**Laptop Capacity:**
- ✅ 1-3 students: Works perfectly
- ⚠️ 4-5 students: May slow down
- 🔴 6+ students: Need cloud deployment

---

## ✅ **Success Checklist**

- [ ] Python ML model running on port 8000
- [ ] Next.js running on port 3000
- [ ] Supabase migration `002_suspicious_snapshots.sql` applied
- [ ] Storage bucket `exam-snapshots` created with RLS policies
- [ ] Admin can create exams
- [ ] Student can start exam and see webcam
- [ ] Focus score updates in real-time (student view)
- [ ] Leaderboard updates in real-time (admin view)
- [ ] Admin can click "Watch" and see live video
- [ ] Suspicious snapshots save when focus_score < 50
- [ ] Admin can view saved snapshots

---

## 🎓 **What Happens During Exam**

### **Every 33ms (30 FPS):**
1. Student's browser captures webcam frame
2. Sends base64 image to Python ML model (WebSocket)
3. ML analyzes: face, eyes, position, behavior
4. Returns focus_score + alerts
5. Browser updates UI

### **Every 3 seconds:**
1. Batch save 3 scores to database
2. Leaderboard recalculates rankings
3. Admin dashboard updates

### **When focus_score < 50:**
1. Capture current frame
2. Upload to Supabase Storage (`exam-snapshots`)
3. Save metadata to `suspicious_snapshots` table
4. Show in admin's Live Video Viewer

### **Throughout exam:**
1. WebRTC stream available for admin
2. Admin can watch any student live
3. All scores tracked in database
4. Final cheat score calculated on submit

---

## 🚀 **Next Steps**

Your system is now production-ready for **small-scale testing** (1-5 students on laptop).

For larger exams (10+ students), see `PRODUCTION_SCALING.md` for cloud deployment.

**Ready to test?** Start with Step 1 above! 🎉
