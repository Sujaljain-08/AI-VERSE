'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StudentLeaderboardItem } from '@/lib/types/database'

interface LeaderboardProps {
  examId?: string
  onSelectStudent: (studentId: string, sessionId: string) => void
}

export default function Leaderboard({ examId, onSelectStudent }: LeaderboardProps) {
  const [students, setStudents] = useState<StudentLeaderboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchLeaderboard()
    
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
            confidence,
            detected_behavior,
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

      // Process and aggregate data
      const leaderboardData: StudentLeaderboardItem[] = data?.map((session: any) => {
        const latestScore = session.cheat_scores?.[0] || { score: 0, confidence: 0, detected_behavior: [], timestamp: new Date().toISOString() }
        
        return {
          student_id: session.student_id,
          student_name: session.profiles?.full_name || 'Unknown Student',
          session_id: session.id,
          exam_title: session.exams?.title || 'Unknown Exam',
          cheat_score: latestScore.score || 0,
          confidence: latestScore.confidence || 0,
          status: session.status,
          detected_behaviors: latestScore.detected_behavior || [],
          last_updated: latestScore.timestamp,
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
    if (score >= 75) return 'text-red-600 bg-red-50 dark:bg-red-900/20'
    if (score >= 50) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
    if (score >= 25) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
    return 'text-green-600 bg-green-50 dark:bg-green-900/20'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-gray-400">Loading leaderboard...</div>
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500 dark:text-gray-400">No active exam sessions</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Students taking exams will appear here in real-time
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {students.map((student, index) => (
        <div
          key={student.session_id}
          onClick={() => onSelectStudent(student.student_id, student.session_id)}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow hover:shadow-md transition-shadow cursor-pointer border-l-4"
          style={{
            borderLeftColor: 
              student.cheat_score >= 75 ? '#dc2626' :
              student.cheat_score >= 50 ? '#ea580c' :
              student.cheat_score >= 25 ? '#ca8a04' : '#16a34a'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="text-2xl font-bold text-gray-400 dark:text-gray-600 w-8">
                #{index + 1}
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {student.student_name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {student.exam_title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Cheat Score */}
              <div className="text-center">
                <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${getScoreColor(student.cheat_score)}`}>
                  {student.cheat_score.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Cheat Score
                </div>
              </div>

              {/* Confidence */}
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  {student.confidence.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Confidence
                </div>
              </div>

              {/* View Button */}
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                View Live
              </button>
            </div>
          </div>

          {/* Detected Behaviors */}
          {student.detected_behaviors && student.detected_behaviors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                {student.detected_behaviors.map((behavior, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded"
                  >
                    {behavior}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
