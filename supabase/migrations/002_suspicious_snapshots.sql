-- Create suspicious_snapshots table for storing captured frames when cheating detected
CREATE TABLE IF NOT EXISTS public.suspicious_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.suspicious_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for suspicious_snapshots
CREATE POLICY "Admins can view all snapshots" ON public.suspicious_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Students can view their own snapshots" ON public.suspicious_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE exam_sessions.id = suspicious_snapshots.session_id
      AND exam_sessions.student_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX idx_suspicious_snapshots_session_id ON public.suspicious_snapshots(session_id);
CREATE INDEX idx_suspicious_snapshots_captured_at ON public.suspicious_snapshots(captured_at DESC);
