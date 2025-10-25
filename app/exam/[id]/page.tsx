'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface AnalysisResult {
  success: boolean;
  focus_score: number;
  raw_frame_score: number;
  status: string;
  state: string;
  away_timer: number;
  alerts: string[];
  timestamp: number;
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;
  
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    setIsDark(theme !== 'light');
  }, []);
  const toggleTheme = () => {
    setIsDark((prev) => {
      localStorage.setItem('theme', prev ? 'light' : 'dark');
      return !prev;
    });
  };
  
  const [examTitle, setExamTitle] = useState('Loading...');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  const [isStarted, setIsStarted] = useState(false);
  const [currentScore, setCurrentScore] = useState(100);
  const [status, setStatus] = useState('Ready to start');
  const [alerts, setAlerts] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [manualAlerts, setManualAlerts] = useState<string[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [questionPaneWidth, setQuestionPaneWidth] = useState(0.65);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Stream reference for camera
  const streamRef = useRef<MediaStream | null>(null);
  
  // WebRTC for admin live viewing
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Score buffer for batch saving
  const scoreBufferRef = useRef<AnalysisResult[]>([]);
  const supabase = createClient();
  const tabInactiveRef = useRef(false);
  const manualAlertsRef = useRef<string[]>([]);
  const remoteAlertsRef = useRef<string[]>([]);
  const isStartedRef = useRef(false);
  const TAB_INACTIVE_ALERT = 'tab_inactive';
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  
  // Stricter tab inactivity tracking
  const lastActivityTimeRef = useRef<number>(0);
  const tabInactiveCountRef = useRef<number>(0);
  const TAB_INACTIVITY_THRESHOLD = 500; // 0.5 seconds without activity = flag (STRICTER)
  const TAB_INACTIVITY_TOLERANCE = 1500; // 1.5 seconds total before penalty (STRICTER)

  // Tab restriction & fullscreen enforcement
  const isFullscreenRef = useRef(false);
  const TAB_SWITCH_ALERT = 'tab_switched_away';
  const FULLSCREEN_EXIT_ALERT = 'exited_fullscreen';
  
  // Snapshot tracking - more rigorous criteria
  const lastSnapshotTimeRef = useRef<number>(0);
  const lowScoreCountRef = useRef<number>(0);
  const SNAPSHOT_COOLDOWN = 10000; // 10 seconds between snapshots
  const LOW_SCORE_THRESHOLD = 30; // Only capture if score < 30 (very suspicious)
  const CONSECUTIVE_LOW_SCORES = 3; // Need 3 consecutive low scores

  useEffect(() => {
    manualAlertsRef.current = manualAlerts;
    setAlerts(Array.from(new Set([...remoteAlertsRef.current, ...manualAlerts])));
  }, [manualAlerts]);

  useEffect(() => {
    isStartedRef.current = isStarted;

    if (isStarted) {
      // Disable right-click context menu during exam
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        console.log('[Blocked] Right-click context menu');
        return false;
      };

      // Prevent text selection and copying
      const handleSelectStart = (e: Event) => {
        // Only block during exam
        if (isStartedRef.current) {
          (e as any).preventDefault?.();
        }
      };

      // Prevent copy
      const handleCopy = (e: ClipboardEvent) => {
        e.preventDefault();
        console.log('[Blocked] Copy attempt');
        return false;
      };

      // Prevent cut
      const handleCut = (e: ClipboardEvent) => {
        e.preventDefault();
        console.log('[Blocked] Cut attempt');
        return false;
      };

      // Warn before unload
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave the exam? All progress will be lost.';
        return e.returnValue;
      };

      document.addEventListener('contextmenu', handleContextMenu, true);
      document.addEventListener('selectstart', handleSelectStart, true);
      document.addEventListener('copy', handleCopy, true);
      document.addEventListener('cut', handleCut, true);
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Disable body selection
      document.body.style.userSelect = 'none';
      (document.body as any).style.webkitUserSelect = 'none';

      return () => {
        document.removeEventListener('contextmenu', handleContextMenu, true);
        document.removeEventListener('selectstart', handleSelectStart, true);
        document.removeEventListener('copy', handleCopy, true);
        document.removeEventListener('cut', handleCut, true);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.body.style.userSelect = 'auto';
        (document.body as any).style.webkitUserSelect = 'auto';
      };
    }
  }, [isStarted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateMatch = (target: MediaQueryList | MediaQueryListEvent) => {
      setIsDesktop(target.matches);
    };
    updateMatch(mediaQuery);
    const listener = (event: MediaQueryListEvent) => updateMatch(event);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
    } else {
      // Fallback for Safari
      // @ts-ignore
      mediaQuery.addListener(listener);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', listener);
      } else {
        // @ts-ignore
        mediaQuery.removeListener(listener);
      }
    };
  }, []);

  // Fetch exam details and start session
  useEffect(() => {
    const initExam = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUserId(user.id);

        // Fetch exam details
        const { data: exam } = await supabase
          .from('exams')
          .select('title, questions')
          .eq('id', examId)
          .single();

        if (!exam) {
          setStatus('Exam not found');
          setTimeout(() => router.push('/dashboard'), 2000);
          return;
        }

        setExamTitle(exam.title);
        if (exam.questions) {
          if (Array.isArray(exam.questions)) {
            setQuestions(exam.questions.filter((item: unknown) => typeof item === 'string') as string[]);
          } else if (typeof exam.questions === 'string') {
            try {
              const parsed = JSON.parse(exam.questions);
              if (Array.isArray(parsed)) {
                setQuestions(parsed.filter((item: unknown) => typeof item === 'string') as string[]);
              } else {
                setQuestions([]);
              }
            } catch {
              setQuestions([]);
            }
          } else {
            setQuestions([]);
          }
        } else {
          setQuestions([]);
        }

        // Start exam session
        const response = await fetch('/api/exam/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exam_id: examId, student_id: user.id }),
        });

        if (!response.ok) {
          const error = await response.json();
          setStatus(`Error: ${error.error || 'Failed to start exam'}`);
          setTimeout(() => router.push('/dashboard'), 2000);
          return;
        }

        const result = await response.json();
        if (result.success) {
          setSessionId(result.session_id);
          setRoomId(`exam-${result.session_id}`);
        } else {
          setStatus(`Error: ${result.error || 'Failed to start exam'}`);
          setTimeout(() => router.push('/dashboard'), 2000);
        }
      } catch (error) {
        console.error('Error initializing exam:', error);
        setStatus('Error initializing exam');
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    };

    initExam();
  }, [examId, router, supabase]);

  // Setup WebRTC for admin live viewing
  const setupWebRTC = useCallback(async (stream: MediaStream) => {
    if (!roomId) return;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerRef.current = peer;

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    const channel = supabase.channel(`webrtc:${roomId}`, {
      config: { broadcast: { ack: true } },
    });
    channelRef.current = channel;

    peer.onicecandidate = async (event) => {
      if (event.candidate && channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'streamer-candidate',
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };

    channel.on('broadcast', { event: 'viewer-ready' }, async () => {
      if (!peerRef.current) return;
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      await channel.send({
        type: 'broadcast',
        event: 'offer',
        payload: { sdp: offer.sdp },
      });
    });

    channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      if (!peerRef.current || !payload?.sdp) return;
      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: payload.sdp })
      );
    });

    channel.on('broadcast', { event: 'viewer-candidate' }, async ({ payload }) => {
      if (!peerRef.current || !payload?.candidate) return;
      await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    await channel.subscribe();
  }, [roomId, supabase]);

  // Start exam
  const startExam = async () => {
    if (!sessionId || !userId) return;

    try {
      tabInactiveRef.current = false;
      setManualAlerts([]);
      remoteAlertsRef.current = [];
      setAlerts([]);
      // Get webcam access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Setup WebRTC for admin viewing
      await setupWebRTC(stream);

      // Start ML analysis (no WebSocket needed, using HTTP POST)
      console.log('Starting ML analysis via HTTP');
      setStatus('Monitoring started');
      setIsStarted(true);
      isStartedRef.current = true;

      // Request fullscreen for maximum security
      try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
          isFullscreenRef.current = true;
          console.log('[Exam] Entered fullscreen mode');
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
          isFullscreenRef.current = true;
        }
      } catch (error) {
        console.warn('Could not enter fullscreen:', error);
        // Still allow exam to proceed
      }

      await captureAndAnalyze();

    } catch (error) {
      console.error('Failed to start exam:', error);
      alert('Failed to access webcam. Please allow camera access.');
    }
  };

  // Capture frame and send to ML model via HTTP POST
  const captureAndAnalyze = async () => {
    if (!isStartedRef.current) {
      console.log('[Capture] Stopped - exam not started');
      return;
    }
    if (!videoRef.current || !canvasRef.current) {
      console.log('[Capture] Waiting for video/canvas...');
      setTimeout(captureAndAnalyze, 1000);
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    // Send frame to ML server via HTTP POST
    try {
      const baseUrl = process.env.NEXT_PUBLIC_ML_SERVER_URL || '/api/ml-proxy';
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: imageData }),
      });

      if (response.ok) {
        const result: AnalysisResult = await response.json();
        
        console.log('[ML Result]', result.success ? '✅' : '❌', `Focus: ${result.focus_score}`);
        
        if (result.success) {
          setCurrentScore(Math.round(result.focus_score));
          setStatus(result.status);
          const remoteAlerts = result.alerts || [];
          remoteAlertsRef.current = remoteAlerts;
          setAlerts(Array.from(new Set([...remoteAlerts, ...manualAlertsRef.current])));

          // Add to buffer
          scoreBufferRef.current.push(result);
          console.log('[Score Buffer] Size:', scoreBufferRef.current.length);

          // More rigorous snapshot criteria
          const now = Date.now();
          const timeSinceLastSnapshot = now - lastSnapshotTimeRef.current;
          const hasCriticalAlerts = remoteAlerts.some(alert => 
            alert.includes('device_detected') || 
            alert.includes('looking_away') || 
            alert.includes('no_face')
          );

          // Track consecutive low scores
          if (result.focus_score < LOW_SCORE_THRESHOLD) {
            lowScoreCountRef.current++;
          } else {
            lowScoreCountRef.current = 0; // Reset if score improves
          }

          // Only capture snapshot if:
          // 1. Cooldown period has passed (10 seconds)
          // 2. Score is critically low (< 30) for 3 consecutive frames
          // 3. OR there are critical alerts present
          const shouldCapture = 
            timeSinceLastSnapshot > SNAPSHOT_COOLDOWN &&
            (
              (lowScoreCountRef.current >= CONSECUTIVE_LOW_SCORES) ||
              hasCriticalAlerts
            );

          if (shouldCapture) {
            console.log('[Snapshot Trigger]', {
              lowScoreCount: lowScoreCountRef.current,
              hasCriticalAlerts,
              currentScore: result.focus_score
            });
            captureSnapshot();
            lastSnapshotTimeRef.current = now;
            lowScoreCountRef.current = 0; // Reset counter after capture
          }
        }
      } else {
        console.error('[ML Error]', response.status, await response.text());
      }
    } catch (error) {
      console.error('[ML analysis error]', error);
    }

    // Continue at 30 FPS
    setTimeout(captureAndAnalyze, 33);
  };

  // Capture and save suspicious snapshot
  const captureSnapshot = async () => {
    if (!canvasRef.current || !sessionId || !userId) {
      console.log('Cannot capture snapshot - missing requirements:', {
        canvas: !!canvasRef.current,
        sessionId: !!sessionId,
        userId: !!userId
      })
      return;
    }

    console.log('Capturing suspicious snapshot...')
    const canvas = canvasRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
    });

    // Upload to Supabase Storage
    const filename = `${userId}/${sessionId}/${Date.now()}.jpg`;
    console.log('Uploading snapshot:', filename)
    
    const { data, error } = await supabase.storage
      .from('exam-snapshots')
      .upload(filename, blob);

    if (error) {
      console.error('Error uploading snapshot:', error)
      return
    }

    if (data) {
      console.log('Snapshot uploaded successfully, saving to DB:', data.path)
      
      // Save metadata to database
      const { error: dbError } = await supabase.from('suspicious_snapshots').insert({
        session_id: sessionId,
        storage_path: data.path,
        captured_at: new Date().toISOString(),
      });

      if (dbError) {
        console.error('Error saving snapshot metadata:', dbError)
      } else {
        console.log('Snapshot metadata saved successfully')
      }
    }
  };

  useEffect(() => {
    if (!isStarted) {
      return;
    }

    // Track user activity (keyboard, mouse, focus)
    const updateActivity = () => {
      lastActivityTimeRef.current = Date.now();
      if (tabInactiveRef.current && tabInactiveCountRef.current < 1) {
        // Only allow one recovery - stricter enforcement
        tabInactiveRef.current = false;
        setManualAlerts((prev) => prev.filter((alert) => alert !== TAB_INACTIVE_ALERT));
        console.log('[Activity] Recovered from inactivity (final warning)');
      }
    };

    const flagTabInactive = (reason: string) => {
      if (!isStarted || tabInactiveRef.current) {
        return;
      }
      tabInactiveRef.current = true;
      tabInactiveCountRef.current++;
      setStatus(`Exam tab inactive (${reason})`);
      setManualAlerts((prev) => (prev.includes(TAB_INACTIVE_ALERT) ? prev : [...prev, TAB_INACTIVE_ALERT]));
      console.log(`[Tab Inactive] Flagged: ${reason} (Count: ${tabInactiveCountRef.current})`);
      scoreBufferRef.current.push({
        success: true,
        focus_score: 0,
        raw_frame_score: 0,
        status: `Exam tab inactive - ${reason}`,
        state: 'tab_inactive',
        away_timer: 0,
        alerts: [TAB_INACTIVE_ALERT],
        timestamp: Date.now(),
      });
    };

    const clearTabInactiveFlag = () => {
      if (!tabInactiveRef.current) {
        return;
      }
      tabInactiveRef.current = false;
      setManualAlerts((prev) => prev.filter((alert) => alert !== TAB_INACTIVE_ALERT));
      console.log('[Tab Inactive] Cleared');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flagTabInactive('visibility_hidden');
        // Add tab switch alert - student switched to another tab
        setManualAlerts((prev) => (prev.includes(TAB_SWITCH_ALERT) ? prev : [...prev, TAB_SWITCH_ALERT]));
        console.log('[Tab Switch] Student switched away from exam tab');
      } else {
        updateActivity();
        clearTabInactiveFlag();
      }
    };

    const handleWindowBlur = () => {
      flagTabInactive('window_blur');
      // Also flag as tab switch for extra severity
      setManualAlerts((prev) => (prev.includes(TAB_SWITCH_ALERT) ? prev : [...prev, TAB_SWITCH_ALERT]));
    };

    const handleWindowFocus = () => {
      updateActivity();
      clearTabInactiveFlag();
    };

    const handleKeyDown = () => {
      updateActivity();
    };

    const handleMouseMove = () => {
      updateActivity();
    };

    const handleMouseDown = () => {
      updateActivity();
    };

    // Block keyboard shortcuts that could open new tabs or navigate away
    const handleKeyDownShortcuts = (e: KeyboardEvent) => {
      if (!isStartedRef.current) return;

      // Ctrl+T, Cmd+T - New Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        console.log('[Blocked] Ctrl+T - New tab attempt');
        return false;
      }

      // Ctrl+N, Cmd+N - New Window
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        console.log('[Blocked] Ctrl+N - New window attempt');
        return false;
      }

      // Ctrl+W, Cmd+W - Close Tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        console.log('[Blocked] Ctrl+W - Close tab attempt');
        return false;
      }

      // Alt+Tab - Switch Application (Windows)
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        console.log('[Blocked] Alt+Tab - App switch attempt');
        return false;
      }

      // Cmd+Tab - Switch Application (Mac)
      if (e.metaKey && e.key === 'Tab') {
        e.preventDefault();
        console.log('[Blocked] Cmd+Tab - App switch attempt');
        return false;
      }

      // F11 - Fullscreen toggle (prevent exiting)
      if (e.key === 'F11') {
        e.preventDefault();
        console.log('[Blocked] F11 - Fullscreen toggle attempt');
        return false;
      }
    };

    // Inactivity monitoring - check if user hasn't interacted in threshold
    const inactivityInterval = setInterval(() => {
      if (!isStartedRef.current) return;
      const timeSinceActivity = Date.now() - lastActivityTimeRef.current;
      
      if (timeSinceActivity > TAB_INACTIVITY_THRESHOLD) {
        if (!tabInactiveRef.current) {
          flagTabInactive('no_interaction');
        }
      } else if (timeSinceActivity < 300 && tabInactiveRef.current && tabInactiveCountRef.current < 1) {
        // Very tight grace period for recovery (only one chance)
        clearTabInactiveFlag();
      }
    }, 200); // Check more frequently for stricter enforcement

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('keydown', handleKeyDown, true); // Capture phase for better detection
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDownShortcuts, true); // Block dangerous shortcuts

    // Fullscreen change detection
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );

      if (isFullscreenRef.current && !isCurrentlyFullscreen) {
        // Student exited fullscreen
        console.log('[Fullscreen] Student exited fullscreen - flagging as cheating attempt');
        setManualAlerts((prev) => (prev.includes(FULLSCREEN_EXIT_ALERT) ? prev : [...prev, FULLSCREEN_EXIT_ALERT]));
        setStatus('⚠️ Fullscreen exited - exam flagged');
      } else if (!isFullscreenRef.current && isCurrentlyFullscreen) {
        // Entered fullscreen
        isFullscreenRef.current = true;
        console.log('[Fullscreen] Entered fullscreen mode');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      clearInterval(inactivityInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDownShortcuts, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, [isStarted]);

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDesktop) return;
    event.preventDefault();
    isResizingRef.current = true;
    document.body.style.userSelect = 'none';
  }, [isDesktop]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current || !layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const relativeX = (event.clientX - rect.left) / rect.width;
      const clamped = Math.max(0.45, Math.min(0.85, relativeX));
      setQuestionPaneWidth(clamped);
    };

    const stopResize = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.removeProperty('user-select');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('mouseleave', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('mouseleave', stopResize);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop && isResizingRef.current) {
      isResizingRef.current = false;
      document.body.style.removeProperty('user-select');
    }
  }, [isDesktop]);


  // Batch save scores every 3 seconds
  useEffect(() => {
    if (!isStarted) return;

    const interval = setInterval(async () => {
      if (scoreBufferRef.current.length === 0) return;

      // Take every 10th score to reduce DB writes
      const scores = scoreBufferRef.current.filter((score, i) => {
        if (Array.isArray(score.alerts) && score.alerts.length > 0) {
          return true;
        }
        return i % 10 === 0;
      });
      
      if (scores.length > 0) {
        await fetch('/api/exam/analyze-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            scores,
          }),
        });
        
        scoreBufferRef.current = [];
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isStarted, sessionId, userId]);

  // Submit exam
  const submitExam = async () => {
    if (!sessionId) return;

    // Stop everything
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
    }
    if (peerRef.current) {
      peerRef.current.close();
    }
    tabInactiveRef.current = false;
    remoteAlertsRef.current = [];
    setManualAlerts([]);
    setAlerts([]);

    console.log("SUBMITTED");
    isStartedRef.current = false;
    setIsStarted(false);

    // Submit exam
    const response = await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });

    const result = await response.json();
    if (result.success) {
      alert(`Exam submitted! Final cheat score: ${result.final_cheat_score}%`);
      router.push('/dashboard');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isStartedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
      tabInactiveRef.current = false;
      document.body.style.removeProperty('user-select');
    };
  }, []);

  return (
    <div className={`min-h-screen py-8 transition-colors duration-300 ${isDark ? 'bg-[#19191C]' : 'bg-white'}`}>
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2 rounded-lg transition-colors z-50 ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-6 h-full px-4 lg:px-0">
        <div className={`rounded-lg shadow-md p-6 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{examTitle}</h1>
            </div>
            <div className="flex items-center gap-2">
              {isStarted ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FD366E] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FD366E]"></span>
                  </span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-[#FD366E]' : 'text-pink-600'}`}>Monitoring Active</span>
                </>
              ) : (
                <span className={`text-sm font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Ready to Start</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 flex-1" ref={layoutRef}>
          <div
            className="relative flex flex-col"
            style={isDesktop ? { flexBasis: `${(questionPaneWidth * 100).toFixed(2)}%`, maxWidth: `${(questionPaneWidth * 100).toFixed(2)}%` } : undefined}
          >
            <div className={`rounded-lg shadow-md p-6 flex-1 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              {!isStarted ? (
                // Show instructions before exam starts
                <>
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#FD366E] to-[#FF6B9D] rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/30">
                        <span className="text-white text-2xl">📋</span>
                      </div>
                      <div>
                        <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Exam Instructions</h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-white/50' : 'text-gray-600'}`}>Please read carefully before starting</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Important Guidelines */}
                    <div className={`rounded-lg border-l-4 border-red-500 p-6 backdrop-blur-sm ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                      <h3 className={`font-bold mb-4 flex items-center gap-2 text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                        Important Guidelines
                      </h3>
                      <ul className={`space-y-3 text-sm ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                          <span><strong>Camera Monitoring:</strong> Your webcam will be monitored throughout the exam</span>
                        </li>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                          <span><strong>Face Detection:</strong> Keep your face visible and centered at all times</span>
                        </li>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                          <span><strong>Stay Focused:</strong> Looking away repeatedly will be flagged as suspicious</span>
                        </li>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                          <span><strong>No Tab Switching:</strong> Leaving this tab will trigger alerts</span>
                        </li>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                          <span><strong>No Devices:</strong> Keep phones and tablets out of camera view</span>
                        </li>
                      </ul>
                    </div>

                    {/* Setup Checklist */}
                    <div className={`rounded-lg border-l-4 border-green-500 p-6 backdrop-blur-sm ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                      <h3 className={`font-bold mb-4 flex items-center gap-2 text-lg ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.707 2.293a1 1 0 00-1.414 1.414l9 9a1 1 0 001.414-1.414l-9-9zM4 10a2 2 0 11-4 0 2 2 0 014 0zm12 0a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd"/></svg>
                        Setup Checklist
                      </h3>
                      <ul className={`space-y-2.5 text-sm ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          <span>Environment is well-lit</span>
                        </li>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          <span>Face is centered in camera</span>
                        </li>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          <span>All other tabs and apps closed</span>
                        </li>
                        <li className="flex gap-3">
                          <svg className="w-5 h-5 flex-shrink-0 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          <span>Stable internet connection verified</span>
                        </li>
                      </ul>
                    </div>

                    {/* Exam Info Card */}
                    <div className={`rounded-lg border p-6 backdrop-blur-sm ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                      <h3 className={`font-bold mb-4 text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>📝 Exam Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className={`text-xs uppercase font-semibold tracking-wide ${isDark ? 'text-white/50' : 'text-gray-600'}`}>Title</p>
                          <p className={`text-lg font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{examTitle}</p>
                        </div>
                        <div>
                          <p className={`text-xs uppercase font-semibold tracking-wide ${isDark ? 'text-white/50' : 'text-gray-600'}`}>Questions</p>
                          <p className={`text-lg font-semibold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{questions.length > 0 ? questions.length : 'Loading...'}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        <p className={`text-xs uppercase font-semibold tracking-wide ${isDark ? 'text-white/50' : 'text-gray-600'}`}>Session ID</p>
                        <p className={`text-sm font-mono mt-1 break-all ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{sessionId || 'Loading...'}</p>
                      </div>
                    </div>

                    {/* Warning Banner */}
                    <div className={`rounded-lg border-l-4 border-[#FD366E] p-6 backdrop-blur-sm ${isDark ? 'bg-[#FD366E]/10' : 'bg-pink-50'}`}>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-white/90' : 'text-gray-800'}`}>
                        <strong>⚠️ Ready to start?</strong> Once you click &quot;Start Exam&quot;, monitoring begins immediately. Make sure you have completed all the setup checks above. You cannot pause the exam once started.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                // Show questions after exam starts
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#FD366E] to-[#FF6B9D] rounded-lg flex items-center justify-center">
                      <span className="text-white text-xl">📝</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Exam Questions</h2>
                      <p className="text-sm text-white/60 mt-0.5">Answer all questions carefully</p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-4">
                    {questions.length === 0 ? (
                      <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-8 text-white/60 text-center">
                        <p className="mb-2">📚 Sample Questions</p>
                        <p className="text-sm">Questions will appear here once added by your instructor.</p>
                      </div>
                    ) : (
                      questions.map((question, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-5 hover:border-[#FD366E]/50 hover:bg-white/[0.07] transition-all duration-200"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-[#FD366E] to-[#FF6B9D] rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-pink-500/20">
                              {index + 1}
                            </span>
                            <div className="flex-1 pt-1">
                              <p className="text-white leading-relaxed">{question}</p>
                              <textarea
                                className="mt-4 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:ring-2 focus:ring-[#FD366E] focus:border-[#FD366E] outline-none resize-none transition-all"
                                rows={3}
                                placeholder="Type your answer here..."
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <div
              className="hidden lg:flex absolute top-0 right-0 h-full w-2 cursor-col-resize items-center justify-center group"
              onMouseDown={startResize}
              role="presentation"
            >
              <span className="h-12 w-1 rounded-full bg-[#FD366E]/30 transition-colors group-hover:bg-[#FD366E]" />
            </div>
          </div>

          <div
            className="lg:flex-1 flex flex-col gap-4"
            style={isDesktop ? { flexBasis: `${((1 - questionPaneWidth) * 100).toFixed(2)}%` } : undefined}
          >
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <span>📹</span> Your Webcam
                </h2>
                {isStarted ? (
                  <span className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 text-sm font-semibold rounded-full border border-red-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    Recording
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm font-semibold rounded-full border border-yellow-500/30">
                    Ready
                  </span>
                )}
              </div>
              <div className="relative bg-black/50 border border-white/10 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isStarted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="text-center text-white space-y-3 px-6">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium">Camera will activate when you start</p>
                      <p className="text-xs text-white/60">Ensure your face is centered and well-lit</p>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className={`rounded-lg shadow-md p-6 flex flex-col gap-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Exam Controls</h3>
                <span className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                  {isStarted ? 'Session active' : 'Session not started'}
                </span>
              </div>
              <div className="flex gap-3">
                {!isStarted ? (
                  <button
                    onClick={startExam}
                    disabled={!sessionId}
                    className="flex-1 bg-gradient-to-r from-[#FD366E] to-[#FF6B9D] hover:shadow-lg hover:shadow-pink-500/30 text-white font-semibold py-3.5 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <span>▶️</span> Start Exam
                  </button>
                ) : (
                  <button
                    onClick={submitExam}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/30 text-white font-semibold py-3.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>✅</span> Submit Exam
                  </button>
                )}
              </div>
              <div className={`rounded-lg px-4 py-3 text-sm ${isDark ? 'bg-white/5 border border-white/10 text-white/70' : 'bg-gray-100 border border-gray-300 text-gray-700'}`}>
                {status}
              </div>
            </div>

            <div className={`rounded-lg shadow-md p-6 flex flex-col gap-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Detection Results</h3>
                <span
                  className={`text-2xl font-bold ${
                    currentScore >= 85
                      ? 'text-green-400'
                      : currentScore >= 70
                      ? 'text-yellow-400'
                      : currentScore >= 50
                      ? 'text-orange-400'
                      : 'text-red-400'
                  }`}
                >
                  {currentScore}%
                </span>
              </div>
              <div className={`rounded-full h-3 overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-300'}`}>
                <div
                  className={`h-full transition-all ${
                    currentScore >= 85
                      ? 'bg-green-500'
                      : currentScore >= 70
                      ? 'bg-yellow-500'
                      : currentScore >= 50
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${currentScore}%` }}
                />
              </div>
              <div className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-700'}`}>
                <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Current state:</p>
                <p>{status}</p>
              </div>
              <div>
                <p className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span>🚨</span> Live alerts
                </p>
                {alerts.length === 0 ? (
                  <div className={`rounded-lg border px-4 py-3 text-sm text-center ${isDark ? 'border-white/10 bg-white/5 text-white/60' : 'border-gray-300 bg-gray-100 text-gray-600'}`}>
                    No suspicious activity detected
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {alerts.map((alert, index) => (
                      <li
                        key={index}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-red-400 flex items-center gap-2"
                      >
                        <span>⚠️</span>
                        <span>{alert.replace(/_/g, ' ').toUpperCase()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-lg px-6 py-5 ${isDark ? 'bg-[#FD366E]/10 border border-[#FD366E]/30' : 'bg-pink-50 border border-pink-200'}`}>
          <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <span>📋</span> Final Checklist
          </h4>
          <div className={`flex flex-wrap gap-x-6 gap-y-2 text-sm ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
            <span className="flex items-center gap-2">
              <span className="text-[#FD366E]">•</span> Keep looking at the screen
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#FD366E]">•</span> Stay fully within the camera frame
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#FD366E]">•</span> Avoid looking away or leaving the tab
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#FD366E]">•</span> Keep phones and tablets out of view
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#FD366E]">•</span> Admin can view you live at any time
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
