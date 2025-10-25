'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StudentLeaderboardItem } from '@/lib/types/database'

interface LeaderboardProps {
  examId?: string
  onSelectStudent: (studentId: string, sessionId: string) => void
  isDark?: boolean
}

export default function Leaderboard({ examId, onSelectStudent, isDark = true }: LeaderboardProps) {
  const [students, setStudents] = useState<StudentLeaderboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchLeaderboard()
    
    // Refresh every 3 seconds for average score updates
    const interval = setInterval(() => {
      fetchLeaderboard()
    }, 3000)

    // Subscribe to real-time updates
    const channel = supabase
      .channel('cheat_scores_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cheat_scores',
        },
        () => {
          fetchLeaderboard()
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [examId])

  const fetchLeaderboard = async () => {
    try {
      let query = supabase
        .from('exam_sessions')
        .select(`
          id,
          student_id,
          exam_id,
          status,
          exams (
            title
          ),
          profiles (
            full_name
          ),
          cheat_scores (
            score,
            timestamp
          )
        `)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })

      if (examId) {
        query = query.eq('exam_id', examId)
      }

      const { data, error } = await query

      if (error) throw error

      // Process and aggregate data - calculate average score
      const leaderboardData: StudentLeaderboardItem[] = data?.map((session: any) => {
        const scores = session.cheat_scores || []
        const avgScore = scores.length > 0 
          ? scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length 
          : 0
        
        return {
          student_id: session.student_id,
          student_name: session.profiles?.full_name || 'Unknown Student',
          session_id: session.id,
          exam_title: session.exams?.title || 'Unknown Exam',
          cheat_score: avgScore,
          confidence: 0,
          status: session.status,
          detected_behaviors: [],
          last_updated: new Date().toISOString(),
        }
      }) || []

      // Sort by cheat score (highest first)
      leaderboardData.sort((a, b) => b.cheat_score - a.cheat_score)

      setStudents(leaderboardData)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return isDark ? 'text-red-400 bg-red-500/20' : 'text-red-600 bg-red-50'
    if (score >= 50) return isDark ? 'text-orange-400 bg-orange-500/20' : 'text-orange-600 bg-orange-50'
    if (score >= 25) return isDark ? 'text-yellow-400 bg-yellow-500/20' : 'text-yellow-600 bg-yellow-50'
    return isDark ? 'text-green-400 bg-green-500/20' : 'text-green-600 bg-green-50'
  }

  const getRiskLevel = (score: number) => {
    if (score >= 75) return { label: 'CRITICAL', color: isDark ? 'text-red-400' : 'text-red-600' }
    if (score >= 50) return { label: 'HIGH', color: isDark ? 'text-orange-400' : 'text-orange-600' }
    if (score >= 25) return { label: 'MEDIUM', color: isDark ? 'text-yellow-400' : 'text-yellow-600' }
    return { label: 'LOW', color: isDark ? 'text-green-400' : 'text-green-600' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className={isDark ? 'text-white/60' : 'text-gray-500'}>Loading active sessions...</div>
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="text-center p-8">
        <p className={isDark ? 'text-white/60' : 'text-gray-600'}>No active exam sessions</p>
        <p className={`text-sm mt-2 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
          Students taking exams will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {students.map((student, index) => {
        const riskLevel = getRiskLevel(student.cheat_score)
        return (
          <div
            key={student.session_id}
            onClick={() => onSelectStudent(student.student_id, student.session_id)}
            className={`rounded-lg p-4 shadow hover:shadow-md transition-all cursor-pointer border-l-4 ${
              isDark 
                ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                : 'bg-white border-gray-200 hover:shadow-lg'
            }`}
            style={{
              borderLeftColor: 
                student.cheat_score >= 75 ? '#dc2626' :
                student.cheat_score >= 50 ? '#ea580c' :
                student.cheat_score >= 25 ? '#ca8a04' : '#16a34a'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`text-xl font-bold w-8 flex-shrink-0 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                  #{index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {student.student_name}
                  </h3>
                  <p className={`text-sm truncate ${isDark ? 'text-white/50' : 'text-gray-600'}`}>
                    {student.exam_title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                {/* Average Cheat Score */}
                <div className="text-center">
                  <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getScoreColor(student.cheat_score)}`}>
                    {student.cheat_score.toFixed(0)}%
                  </div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-600'}`}>
                    Avg Score
                  </div>
                </div>

                {/* Risk Level Badge */}
                <div className="text-center">
                  <span className={`font-bold text-sm ${riskLevel.color}`}>
                    {riskLevel.label}
                  </span>
                </div>

                {/* View Button */}
                <button className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ${
                  isDark
                    ? 'bg-gradient-to-r from-[#FD366E] to-[#FF6B9D] text-white hover:shadow-lg hover:shadow-pink-500/30'
                    : 'bg-gradient-to-r from-[#FD366E] to-[#FF6B9D] text-white hover:shadow-lg'
                }`}>
                  View
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
