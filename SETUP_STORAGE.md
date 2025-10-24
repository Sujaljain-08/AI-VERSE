# Supabase Storage Setup Guide

## 🗂️ Create Storage Bucket for Video Recordings

Follow these steps to set up video storage in your Supabase project:

### 1. **Create Storage Bucket**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `EXAM_FACE_DETECTION`
3. Navigate to **Storage** in the sidebar
4. Click **"New bucket"**
5. Configure the bucket:
   - **Name**: `exam-recordings`
   - **Public bucket**: ❌ **OFF** (keep videos private)
   - **File size limit**: `50 MB` (per file)
   - **Allowed MIME types**: `video/webm, video/mp4`
6. Click **"Create bucket"**

---

### 2. **Set Up Storage Policies**

After creating the bucket, set up Row Level Security policies:

#### **Policy 1: Allow students to upload their own exam videos**

```sql
-- Go to Storage > Policies > exam-recordings > New Policy

-- Policy Name: Students can upload their own exam videos
-- Operation: INSERT
-- Policy Definition:
CREATE POLICY "Students can upload their own exam videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exam-recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

#### **Policy 2: Allow admins to view all videos**

```sql
-- Policy Name: Admins can view all exam videos
-- Operation: SELECT
-- Policy Definition:
CREATE POLICY "Admins can view all exam videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-recordings' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

#### **Policy 3: Allow students to view their own videos**

```sql
-- Policy Name: Students can view their own exam videos
-- Operation: SELECT
-- Policy Definition:
CREATE POLICY "Students can view their own exam videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exam-recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

### 3. **Verify Setup**

Run this SQL query to check if the bucket was created:

```sql
SELECT * FROM storage.buckets WHERE name = 'exam-recordings';
```

Expected output:
```
id    | name              | public | file_size_limit | allowed_mime_types
------|-------------------|--------|-----------------|--------------------
...   | exam-recordings   | false  | 52428800        | {video/webm, video/mp4}
```

---

### 4. **Test Upload (Optional)**

You can test the upload functionality using the Supabase Storage UI:

1. Go to **Storage > exam-recordings**
2. Create a test folder: `test-student-id/`
3. Upload a small video file (< 50MB)
4. Verify it appears in the bucket

---

## 📁 Storage Structure

Videos will be organized as:

```
exam-recordings/
├── {student_id}/
│   ├── {session_id}/
│   │   ├── {timestamp1}.webm
│   │   ├── {timestamp2}.webm
│   │   └── {timestamp3}.webm
```

Example:
```
exam-recordings/
├── abc123-def456-ghi789/
│   ├── session-uuid-1/
│   │   ├── 1729785600000.webm
│   │   └── 1729785650000.webm
```

---

## ✅ Next Steps

After completing storage setup:

1. ✅ Storage bucket created: `exam-recordings`
2. ✅ RLS policies configured (students upload own, admins view all)
3. ✅ Ready to start recording videos when cheating detected!

You can now proceed with testing the exam system.
