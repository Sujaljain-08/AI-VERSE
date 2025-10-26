# Student Snapshot Retrieval System

## Overview
Admin portal now includes a comprehensive snapshot archive system for reviewing captured suspicious activity snapshots after exams. This is useful for reconsideration cases and detailed exam reviews.

## Unique Properties for Searching Snapshots

### 1. **Session ID** (Most Specific)
- **Use Case**: Review all snapshots from a specific exam session
- **Property**: `session_id` (UUID)
- **Example**: `550e8400-e29b-41d4-a716-446655440000`
- **Best For**: Reviewing a single student's specific exam attempt

### 2. **Student ID**
- **Use Case**: Review all snapshots for a specific student across all exams
- **Property**: `student_id` (UUID)
- **Example**: `123e4567-e89b-12d3-a456-426614174000`
- **Best For**: Checking a student's exam history for patterns

### 3. **Exam ID**
- **Use Case**: Review all snapshots from all students in a specific exam
- **Property**: `exam_id` (UUID)
- **Best For**: Comprehensive exam review, detecting widespread issues

### 4. **Student Email**
- **Use Case**: Search when you only know the student's email
- **Property**: Student's registered email
- **Example**: `student@university.edu`
- **Best For**: Quick searches without needing database IDs

## Features

### Admin Portal - Snapshots Tab
The admin dashboard now has two tabs:
1. **Live Monitoring** - Real-time exam monitoring (existing feature)
2. **Snapshots Archive** - Historical snapshot review (new feature)

### Search Capabilities
- **Multiple Search Types**: Session ID, Student ID, Exam, or Email
- **Dropdown Selectors**: For Exam and Student ID searches
- **Text Input**: For Session ID and Email searches
- **Flexible Filtering**: Results limited to 50 by default (configurable)

### Display Features
- **Grid Layout**: Responsive 3-column grid of snapshot thumbnails
- **Session Status**: Visual indicators (submitted, flagged, in progress)
- **Timestamp**: When the snapshot was captured
- **Student & Exam Info**: Clear labeling of who and what exam

### Full-Size Viewer
Click any snapshot to open a modal with:
- **Full-size image** display
- **Complete metadata**: Student name, exam title, capture time, session status
- **Download option**: One-click download with descriptive filename
- **Session details**: Session ID, submission time

## API Endpoint

### GET `/api/admin/snapshots`

**Query Parameters:**
- `studentId` (optional): Filter by student UUID
- `sessionId` (optional): Filter by session UUID
- `examId` (optional): Filter by exam UUID
- `studentEmail` (optional): Filter by student email (partial match)
- `limit` (optional): Max results to return (default: 50)

**Response:**
```json
{
  "snapshots": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "storage_path": "path/to/image.jpg",
      "captured_at": "2025-10-26T10:30:00Z",
      "created_at": "2025-10-26T10:30:00Z",
      "image_url": "signed-url-for-access",
      "student": {
        "id": "uuid",
        "name": "Student Name"
      },
      "exam": {
        "id": "uuid",
        "title": "Exam Title",
        "start_time": "2025-10-26T09:00:00Z",
        "end_time": "2025-10-26T11:00:00Z"
      },
      "session_status": "submitted",
      "submitted_at": "2025-10-26T10:45:00Z"
    }
  ],
  "total": 15
}
```

**Authentication:**
- Requires admin role
- Returns 401 if not authenticated
- Returns 403 if not admin

## Database Schema

### `suspicious_snapshots` Table
```sql
- id: UUID (primary key)
- session_id: UUID (references exam_sessions)
- storage_path: TEXT (path in Supabase storage)
- captured_at: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
```

### Relationships
- **exam_sessions**: Links to specific exam session
- **profiles**: Through session to get student info
- **exams**: Through session to get exam details

## Security

### Row Level Security (RLS)
- **Admins**: Can view all snapshots
- **Students**: Can only view their own snapshots
- **Unauthenticated**: No access

### Signed URLs
- All image URLs are signed with 1-hour expiry
- Secure access to Supabase storage
- No direct storage access

## Use Cases

### 1. Reconsideration Requests
Student appeals their exam score:
1. Admin searches by **Student ID** or **Email**
2. Filters to specific **Exam** if needed
3. Reviews all flagged snapshots
4. Downloads evidence for review committee

### 2. Exam-Wide Analysis
Reviewing entire exam for issues:
1. Admin selects **Exam ID** from dropdown
2. Views all student snapshots from that exam
3. Identifies patterns or system issues
4. Downloads snapshots for documentation

### 3. Individual Session Review
Specific exam session flagged:
1. Admin enters **Session ID** from leaderboard
2. Views all snapshots from that session
3. Reviews timeline of suspicious activity
4. Makes informed decision on exam validity

### 4. Student History Check
Before making decisions on repeat offender:
1. Admin searches by **Student ID**
2. Reviews snapshots across all exams
3. Identifies behavioral patterns
4. Makes evidence-based decisions

## Benefits

1. **Post-Exam Review**: Access snapshots after exam completion
2. **Evidence Collection**: Download snapshots for records
3. **Fair Reconsideration**: Visual evidence for appeals
4. **Pattern Detection**: Identify repeat issues or system problems
5. **Audit Trail**: Complete history of flagged activities
6. **Flexible Search**: Multiple ways to find relevant snapshots

## Technical Details

### Component: `SnapshotViewer`
- **Location**: `components/admin/SnapshotViewer.tsx`
- **Props**: `isDark` (optional boolean)
- **Features**: Search, grid display, modal viewer, download

### API Route: Snapshot Retrieval
- **Location**: `app/api/admin/snapshots/route.ts`
- **Method**: GET
- **Authentication**: Supabase Auth + Admin role check
- **Storage**: Supabase Storage with signed URLs

### Type Definition
- **Location**: `lib/types/database.ts`
- **Interface**: `SuspiciousSnapshot`
- **Relations**: ExamSession, Profile, Exam
