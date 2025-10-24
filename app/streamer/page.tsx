'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type StreamStatus = 'idle' | 'connecting' | 'waiting_viewer' | 'live' | 'error'

export default function StreamerPage() {
  const supabase = useMemo(() => createClient(), [])
  const [roomId, setRoomId] = useState('')
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

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
      peerRef.current.onicecandidate = null
      peerRef.current.onconnectionstatechange = null
      peerRef.current.close()
      peerRef.current = null
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const startStreaming = async () => {
    if (!roomId.trim()) {
      setMessage('Enter a room identifier to start streaming.')
      return
    }

    cleanup()
    setStatus('connecting')
    setMessage(null)

    try {
      // Capture video only; audio streaming is disabled for this prototype
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      mediaStreamRef.current = localStream

      if (videoRef.current) {
        videoRef.current.srcObject = localStream
        videoRef.current.muted = true
        videoRef.current.play().catch(() => undefined)
      }

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peerRef.current = peer

      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream))

      const channel = supabase.channel(`webrtc:${roomId}`, {
        config: { broadcast: { ack: true } },
      })
      channelRef.current = channel

      peer.onicecandidate = async (event) => {
        if (event.candidate && channelRef.current) {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'streamer-candidate',
            payload: { candidate: event.candidate.toJSON() },
          })
        }
      }

      peer.onconnectionstatechange = () => {
        if (!peerRef.current) return
        if (['failed', 'disconnected'].includes(peerRef.current.connectionState)) {
          setStatus('error')
          setMessage('Viewer disconnected or connection failed. Try restarting the stream.')
        }
      }

      channel.on('broadcast', { event: 'viewer-ready' }, async () => {
        if (!peerRef.current || !channelRef.current) return
        const offer = await peerRef.current.createOffer()
        await peerRef.current.setLocalDescription(offer)
        await channelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: { sdp: offer.sdp },
        })
        setStatus('waiting_viewer')
      })

      channel.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!peerRef.current || !payload?.sdp) return
        if (peerRef.current.currentRemoteDescription) return
        await peerRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }))
        setStatus('live')
        setMessage('Viewer connected. Streaming live.')
      })

      channel.on('broadcast', { event: 'viewer-candidate' }, async ({ payload }) => {
        if (!peerRef.current || !payload?.candidate) return
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch (error) {
          console.error('Failed to add viewer ICE candidate', error)
        }
      })

      await channel.subscribe(async (subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          await channel.send({
            type: 'broadcast',
            event: 'offer',
            payload: { sdp: offer.sdp },
          })
          setStatus('waiting_viewer')
          setMessage('Offer sent. Waiting for viewer to join.')
        }
      })
    } catch (error) {
      console.error('Failed to start stream', error)
      cleanup()
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Failed to start stream. Check camera permissions.')
    }
  }

  const stopStreaming = () => {
    cleanup()
    setStatus('idle')
    setMessage('Stream stopped.')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Streamer Console</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Start a peer-to-peer WebRTC stream. Share the room identifier with your viewer so they can join.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Room identifier (e.g., math-final-1)"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={startStreaming}
                disabled={status === 'connecting' || status === 'waiting_viewer' || status === 'live'}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
              >
                {status === 'idle' || status === 'error' ? 'Start Stream' : 'Streaming...'}
              </button>
              <button
                type="button"
                onClick={stopStreaming}
                disabled={status === 'idle'}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Stop
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
            <video ref={videoRef} className="w-full aspect-video bg-gray-900" playsInline autoPlay />
          ) : (
            <div className="w-full aspect-video bg-gray-900 flex items-center justify-center text-gray-400 text-sm">
              Preparing video surface...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
