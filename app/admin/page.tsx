'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Leaderboard from '@/components/admin/Leaderboard'
import LiveVideoViewer from '@/components/admin/LiveVideoViewer'

export default function AdminPage() {
  const [isDark, setIsDark] = useState(true)
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
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<{
    studentId: string
    sessionId: string
    studentName: string
  } | null>(null)
  const [activeExam, setActiveExam] = useState<string | undefined>()
  const [exams, setExams] = useState<any[]>([])
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    fetchExams()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // Check role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    setUser(user)
    setLoading(false)
  }

  const fetchExams = async () => {
    const { data } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    setExams(data || [])
  }

  const handleSelectStudent = async (studentId: string, sessionId: string) => {
    // Fetch student name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', studentId)
      .single()

    setSelectedStudent({
      studentId,
      sessionId,
      studentName: profile?.full_name || 'Unknown Student'
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#19191C]' : 'bg-white'}`}> 
        <div className={isDark ? 'text-white/60' : 'text-gray-600'}>Loading...</div>
      </div>
    )
  }

  return (
  <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#19191C]' : 'bg-white'}`}> 
      {/* Navigation */}
      <nav className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'} backdrop-blur-md shadow-sm border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin Dashboard</h1>
              <span className="px-3 py-1 bg-gradient-to-r from-[#FD366E]/20 to-[#FF6B9D]/20 text-[#FD366E] text-xs font-semibold rounded-full border border-[#FD366E]/30">ADMIN</span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{user?.user_metadata?.full_name || user?.email}</span>
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
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
              <button onClick={handleSignOut} className={`text-sm font-medium ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-500'}`}>Sign out</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Live Exam Monitoring</h2>
          <p className={isDark ? 'text-white/60' : 'text-gray-600'}>Real-time cheat detection and student monitoring</p>
        </div>

        {/* Filter by Exam */}
        <div className="mb-6 flex items-center gap-4">
          <label className={`text-sm font-medium ${isDark ? 'text-white/70' : 'text-gray-700'}`}>Filter by Exam:</label>
          <select
            value={activeExam || ''}
            onChange={(e) => setActiveExam(e.target.value || undefined)}
            className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#FD366E] focus:border-[#FD366E] backdrop-blur-sm ${isDark ? 'border-white/10 bg-white/5 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
          >
            <option value="">All Active Exams</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>{exam.title}</option>
            ))}
          </select>
        </div>

        {/* Leaderboard */}
        <div className="bg-white/5 border border-white/10 rounded-lg shadow-lg p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cheat Detection Leaderboard</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Students ranked by suspicious activity (highest first)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className={`text-sm font-medium ${isDark ? 'text-white/70' : 'text-gray-700'}`}>Live Updates</span>
            </div>
          </div>

          <Leaderboard examId={activeExam} onSelectStudent={handleSelectStudent} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className={`rounded-lg shadow p-6 backdrop-blur-sm ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200 border'}`}> 
            <div className="flex items-center justify-between">
              <div>
                <p className={isDark ? 'text-sm text-white/60' : 'text-sm text-gray-600'}>Active Sessions</p>
                <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>--</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className={`rounded-lg shadow p-6 backdrop-blur-sm ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200 border'}`}> 
            <div className="flex items-center justify-between">
              <div>
                <p className={isDark ? 'text-sm text-white/60' : 'text-sm text-gray-600'}>High Risk</p>
                <p className="text-2xl font-bold text-red-400 mt-1">--</p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
          <div className={`rounded-lg shadow p-6 backdrop-blur-sm ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200 border'}`}> 
            <div className="flex items-center justify-between">
              <div>
                <p className={isDark ? 'text-sm text-white/60' : 'text-sm text-gray-600'}>Total Exams</p>
                <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{exams.length}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Live Video Viewer Modal */}
      {selectedStudent && (
        <LiveVideoViewer
          student={selectedStudent}
          roomId={`exam-${selectedStudent.sessionId}`}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}
