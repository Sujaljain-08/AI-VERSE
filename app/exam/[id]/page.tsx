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

  useEffect(() => {
    manualAlertsRef.current = manualAlerts;
    setAlerts(Array.from(new Set([...remoteAlertsRef.current, ...manualAlerts])));
  }, [manualAlerts]);

  useEffect(() => {
    isStartedRef.current = isStarted;
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

          // Save snapshot if suspicious (focus_score < 50)
          if (result.focus_score < 50) {
            captureSnapshot();
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

    const flagTabInactive = () => {
      if (!isStarted || tabInactiveRef.current) {
        return;
      }
      tabInactiveRef.current = true;
      setStatus('Exam tab inactive');
      setManualAlerts((prev) => (prev.includes(TAB_INACTIVE_ALERT) ? prev : [...prev, TAB_INACTIVE_ALERT]));
      scoreBufferRef.current.push({
        success: true,
        focus_score: 0,
        raw_frame_score: 0,
        status: 'Exam tab inactive',
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
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flagTabInactive();
      } else {
        clearTabInactiveFlag();
      }
    };

    const handleWindowBlur = () => {
      flagTabInactive();
    };

    const handleWindowFocus = () => {
      clearTabInactiveFlag();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 h-full px-4 lg:px-0">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{examTitle}</h1>
              <p className="text-gray-600 text-sm mt-1">Session ID: {sessionId || 'Loading...'}</p>
            </div>
            <div className="text-sm text-indigo-600 font-semibold">
              {isStarted ? 'Monitoring in progress' : 'Waiting to start'}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 flex-1" ref={layoutRef}>
          <div
            className="relative flex flex-col"
            style={isDesktop ? { flexBasis: `${(questionPaneWidth * 100).toFixed(2)}%`, maxWidth: `${(questionPaneWidth * 100).toFixed(2)}%` } : undefined}
          >
            <div className="bg-white rounded-lg shadow-lg p-6 flex-1">
              <h2 className="text-xl font-semibold text-gray-800">Exam Questions</h2>
              <p className="text-sm text-gray-500 mt-2">Review these before you begin.</p>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                {questions.length === 0 ? (
                  <div className="rounded-md bg-gray-100 px-4 py-3 text-gray-500">
                    Questions will appear here once added by your instructor.
                  </div>
                ) : (
                  questions.map((question, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm"
                    >
                      <span className="block text-xs font-semibold text-indigo-600 mb-2">
                        Question {index + 1}
                      </span>
                      <p className="leading-relaxed">{question}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div
              className="hidden lg:flex absolute top-0 right-0 h-full w-2 cursor-col-resize items-center justify-center group"
              onMouseDown={startResize}
              role="presentation"
            >
              <span className="h-12 w-1 rounded-full bg-indigo-200 transition-colors group-hover:bg-indigo-400" />
            </div>
          </div>

          <div
            className="lg:flex-1 flex flex-col gap-4"
            style={isDesktop ? { flexBasis: `${((1 - questionPaneWidth) * 100).toFixed(2)}%` } : undefined}
          >
            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Your Webcam</h2>
                {isStarted ? (
                  <span className="text-green-500 text-sm font-semibold">Recording</span>
                ) : (
                  <span className="text-yellow-500 text-sm font-semibold">Ready</span>
                )}
              </div>
              <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isStarted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-center text-white text-sm space-y-2">
                      <p>Camera will activate when you start</p>
                      <p className="opacity-75">Ensure your face is centered and well-lit</p>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Exam Controls</h3>
                <span className="text-sm text-gray-500">
                  {isStarted ? 'Session active' : 'Session not started'}
                </span>
              </div>
              <div className="flex gap-3">
                {!isStarted ? (
                  <button
                    onClick={startExam}
                    disabled={!sessionId}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ▶️ Start Exam
                  </button>
                ) : (
                  <button
                    onClick={submitExam}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
                  >
                    ✅ Submit Exam
                  </button>
                  
                )}
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-600">
                {status}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Detection Results</h3>
                <span
                  className={`text-2xl font-bold ${
                    currentScore >= 85
                      ? 'text-green-500'
                      : currentScore >= 70
                      ? 'text-yellow-500'
                      : currentScore >= 50
                      ? 'text-orange-500'
                      : 'text-red-500'
                  }`}
                >
                  {currentScore}%
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
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
              <div className="text-sm text-gray-600">
                <p className="font-semibold text-gray-700">Current state:</p>
                <p className="mt-1">{status}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Live alerts
                </p>
                {alerts.length === 0 ? (
                  <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    No suspicious activity detected.
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm text-red-600">
                    {alerts.map((alert, index) => (
                      <li
                        key={index}
                        className="rounded-md border border-red-100 bg-red-50 px-4 py-2"
                      >
                        {alert.replace(/_/g, ' ').toUpperCase()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg border border-blue-100 px-6 py-5 text-sm text-blue-900">
          <h4 className="font-semibold mb-2">📋 Final Checklist</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-blue-900">
            <span>• Keep looking at the screen</span>
            <span>• Stay fully within the camera frame</span>
            <span>• Avoid looking away or leaving the tab</span>
            <span>• Keep phones and tablets out of view</span>
            <span>• Admin can view you live at any time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
