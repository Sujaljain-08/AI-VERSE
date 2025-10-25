'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type ViewStatus = 'idle' | 'connecting' | 'waiting_offer' | 'watching' | 'error'

export default function ViewerPage() {
  const supabase = useMemo(() => createClient(), [])
  const [isDark, setIsDark] = useState(true)
  const [roomId, setRoomId] = useState('')
  const [status, setStatus] = useState<ViewStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    const theme = localStorage.getItem('theme')
    setIsDark(theme !== 'light')
  }, [])

  const toggleTheme = () => {
    setIsDark((prev) => {
      localStorage.setItem('theme', prev ? 'light' : 'dark')
      return !prev
    })
  }

  useEffect(() => {
    setIsMounted(true)
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanup = () => {
    channelRef.current?.unsubscribe().catch(() => undefined)
    channelRef.current = null

    if (peerRef.current) {
      peerRef.current.ontrack = null
      peerRef.current.onicecandidate = null
      peerRef.current.onconnectionstatechange = null
      peerRef.current.close()
      peerRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const startViewing = async () => {
    if (!roomId.trim()) {
      setMessage('Enter a room identifier to join the stream.')
      return
    }

    cleanup()
    setStatus('connecting')
    setMessage(null)

    try {
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peerRef.current = peer

      peer.ontrack = (event) => {
        const [stream] = event.streams
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => undefined)
        }
      }

      peer.onicecandidate = async (event) => {
        if (event.candidate && channelRef.current) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'viewer-candidate',
            payload: { candidate: event.candidate.toJSON() },
          })
        }
      }

      peer.onconnectionstatechange = () => {
        if (!peerRef.current) return
        if (['disconnected', 'failed', 'closed'].includes(peerRef.current.connectionState)) {
          setStatus('error')
          setMessage('Stream ended or connection failed.')
        }
      }

      const channel = supabase.channel(`webrtc:${roomId}`, {
        config: { broadcast: { ack: true } },
      })
      channelRef.current = channel

      channel.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (!peerRef.current || !payload?.sdp) return

        await peerRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }))
        const answer = await peerRef.current.createAnswer()
        await peerRef.current.setLocalDescription(answer)
        await channel.send({
          type: 'broadcast',
          event: 'answer',
          payload: { sdp: answer.sdp },
        })
        setStatus('watching')
        setMessage('Connected to streamer. Enjoy the live feed.')
      })

      channel.on('broadcast', { event: 'streamer-candidate' }, async ({ payload }) => {
        if (!peerRef.current || !payload?.candidate) return
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch (error) {
          console.error('Failed to add streamer ICE candidate', error)
        }
      })

      await channel.subscribe(async (subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('waiting_offer')
          await channel.send({
            type: 'broadcast',
            event: 'viewer-ready',
            payload: { joinedAt: new Date().toISOString() },
          })
          setMessage('Waiting for streamer to send an offer...')
        }
      })
    } catch (error) {
      console.error('Failed to join stream', error)
      cleanup()
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Unable to join stream. Check network and try again.')
    }
  }

  const stopViewing = () => {
    cleanup()
    setStatus('idle')
    setMessage('Left the stream.')
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2 rounded-lg transition-colors z-50 ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Viewer Console</h1>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Join a WebRTC stream by entering the room identifier provided by the streamer.
          </p>
        </div>

        <div className={`p-6 rounded-xl shadow space-y-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Room identifier (e.g., math-final-1)"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className={`flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-800'}`}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={startViewing}
                disabled={status === 'connecting' || status === 'waiting_offer' || status === 'watching'}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
              >
                {status === 'idle' || status === 'error' ? 'Join Stream' : 'Connecting...'}
              </button>
              <button
                type="button"
                onClick={stopViewing}
                disabled={status === 'idle'}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Leave
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              Status:{' '}
              <strong className="text-gray-900 dark:text-gray-100">
                {status.replace('_', ' ')}
              </strong>
            </span>
            {message && <span>{message}</span>}
          </div>
        </div>

        <div className="bg-black rounded-xl overflow-hidden shadow-lg">
          {isMounted ? (
            <video ref={videoRef} className="w-full aspect-video bg-gray-900" playsInline autoPlay controls={false} />
          ) : (
            <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-gray-400 text-sm">
              Preparing viewer surface...
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>
            This viewer connects through Supabase Realtime for signaling only—media flows peer-to-peer. Ensure your
            environment supports WebRTC and grants camera/microphone permissions to the streamer.
          </p>
        </div>
      </div>
    </div>
  )
}
