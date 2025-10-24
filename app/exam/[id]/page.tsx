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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // WebSocket for ML analysis
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // WebRTC for admin live viewing
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Score buffer for batch saving
  const scoreBufferRef = useRef<AnalysisResult[]>([]);
  const supabase = createClient();

  // Fetch exam details and start session
  useEffect(() => {
    const initExam = async () => {
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
        .select('title')
        .eq('id', examId)
        .single();

      if (exam) {
        setExamTitle(exam.title);
      }

      // Start exam session
      const response = await fetch('/api/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: examId, student_id: user.id }),
      });

      const result = await response.json();
      if (result.success) {
        setSessionId(result.session_id);
        setRoomId(`exam-${result.session_id}`);
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

      // Connect to ML model WebSocket
      const ws = new WebSocket('ws://localhost:8000/analyze');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to ML model');
        setStatus('Monitoring started');
        setIsStarted(true);
        captureAndAnalyze();
      };

      ws.onmessage = (event) => {
        const result: AnalysisResult = JSON.parse(event.data);
        
        if (result.success) {
          setCurrentScore(Math.round(result.focus_score));
          setStatus(result.status);
          setAlerts(result.alerts || []);

          // Add to buffer
          scoreBufferRef.current.push(result);

          // Save snapshot if suspicious (focus_score < 50)
          if (result.focus_score < 50 && canvasRef.current && videoRef.current) {
            captureSnapshot();
          }
        }
      };

      ws.onerror = () => {
        setStatus('Connection error - Make sure ML model is running');
      };

    } catch (error) {
      console.error('Failed to start exam:', error);
      alert('Failed to access webcam. Please allow camera access.');
    }
  };

  // Capture frame and send to ML model
  const captureAndAnalyze = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    wsRef.current.send(JSON.stringify({ frame: imageData }));

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

  // Batch save scores every 3 seconds
  useEffect(() => {
    if (!isStarted) return;

    const interval = setInterval(async () => {
      if (scoreBufferRef.current.length === 0) return;

      // Take every 10th score to reduce DB writes
      const scores = scoreBufferRef.current.filter((_, i) => i % 10 === 0);
      
      if (scores.length > 0) {
        await fetch('/api/exam/analyze-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            student_id: userId,
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
    if (wsRef.current) wsRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
    }
    if (peerRef.current) {
      peerRef.current.close();
    }

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
      if (wsRef.current) wsRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{examTitle}</h1>
          <p className="text-gray-600">Session ID: {sessionId || 'Loading...'}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Your Webcam</h2>
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
                    <div className="text-center text-white">
                      <p className="mb-4">Camera will activate when you start</p>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Monitoring Panel */}
          <div className="space-y-6">
            {/* Focus Score */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Focus Score</h3>
              <div className="text-center">
                <div className={`text-5xl font-bold ${
                  currentScore >= 85 ? 'text-green-500' :
                  currentScore >= 70 ? 'text-yellow-500' :
                  currentScore >= 50 ? 'text-orange-500' :
                  'text-red-500'
                }`}>
                  {currentScore}%
                </div>
                <p className="text-sm text-gray-600 mt-2">{status}</p>
              </div>
              
              {/* Score Bar */}
              <div className="mt-4 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    currentScore >= 85 ? 'bg-green-500' :
                    currentScore >= 70 ? 'bg-yellow-500' :
                    currentScore >= 50 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${currentScore}%` }}
                />
              </div>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                <h3 className="text-red-800 font-semibold mb-2">⚠️ Alerts</h3>
                <ul className="text-red-700 text-sm space-y-1">
                  {alerts.map((alert, i) => (
                    <li key={i}>• {alert.replace(/_/g, ' ').toUpperCase()}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Controls */}
            <div className="space-y-3">
              {!isStarted ? (
                <button
                  onClick={startExam}
                  disabled={!sessionId}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  ▶️ Start Exam
                </button>
              ) : (
                <button
                  onClick={submitExam}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
                >
                  ✅ Submit Exam
                </button>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              <h4 className="font-semibold mb-2">📋 Instructions:</h4>
              <ul className="space-y-1">
                <li>• Keep looking at the screen</li>
                <li>• Stay in camera frame</li>
                <li>• Don't look away for long</li>
                <li>• Admin can view you live</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
