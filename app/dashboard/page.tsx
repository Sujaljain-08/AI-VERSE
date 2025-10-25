'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Exam } from '@/lib/types/database'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [exams, setExams] = useState<Exam[]>([])
  const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available')
  
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

    // Check user role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Redirect admins to admin dashboard
    if (profile?.role === 'admin') {
      router.push('/admin')
      return
    }

    setUser(user)
    setLoading(false)
  }

  const fetchExams = async () => {
    const now = new Date().toISOString()
    
    const { data } = await supabase
      .from('exams')
      .select('*')
      .gte('end_time', now)
      .order('start_time', { ascending: true })
    
    setExams(data || [])
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isExamActive = (exam: Exam) => {
    const now = new Date()
    const start = new Date(exam.start_time)
    const end = new Date(exam.end_time)
    return now >= start && now <= end
  }

  const isExamUpcoming = (exam: Exam) => {
    const now = new Date()
    const start = new Date(exam.start_time)
    return now < start
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#19191C]">
        <div className="text-white/60">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#19191C]">
      {/* Navigation */}
      <nav className="bg-white/5 backdrop-blur-md shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">
                Student Dashboard
              </h1>
              <span className="px-3 py-1 bg-gradient-to-r from-[#FD366E]/20 to-[#FF6B9D]/20 text-[#FD366E] text-xs font-semibold rounded-full border border-[#FD366E]/30">
                STUDENT
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/70">
                {user?.user_metadata?.full_name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-red-400 hover:text-red-300 font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome, {user?.user_metadata?.full_name || 'Student'}!
          </h2>
          <p className="text-white/60">
            View and take your scheduled exams
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-white/10">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('available')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'available'
                  ? 'border-[#FD366E] text-[#FD366E]'
                  : 'border-transparent text-white/60 hover:text-white/80'
              }`}
            >
              Available Exams
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'completed'
                  ? 'border-[#FD366E] text-[#FD366E]'
                  : 'border-transparent text-white/60 hover:text-white/80'
              }`}
            >
              Completed Exams
            </button>
          </nav>
        </div>

        {/* Exams List */}
        {activeTab === 'available' && (
          <div className="space-y-4">
            {exams.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-lg shadow p-12 text-center backdrop-blur-sm">
                <svg className="w-16 h-16 mx-auto text-white/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-white mb-2">
                  No Available Exams
                </h3>
                <p className="text-white/60">
                  Check back later for scheduled exams
                </p>
              </div>
            ) : (
              exams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-white/5 border border-white/10 rounded-lg shadow hover:shadow-lg hover:border-[#FD366E]/30 transition-all p-6 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">
                          {exam.title}
                        </h3>
                        {isExamActive(exam) && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full flex items-center gap-1 border border-green-500/30">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            LIVE
                          </span>
                        )}
                        {isExamUpcoming(exam) && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/30">
                            UPCOMING
                          </span>
                        )}
                      </div>
                      
                      {exam.description && (
                        <p className="text-white/60 mb-4">
                          {exam.description}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-white/60">Start Time</p>
                          <p className="text-sm font-medium text-white">
                            {formatDate(exam.start_time)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-white/60">Duration</p>
                          <p className="text-sm font-medium text-white">
                            {exam.duration_minutes} minutes
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-6">
                      {isExamActive(exam) ? (
                        <button 
                          onClick={() => router.push(`/exam/${exam.id}`)}
                          className="px-6 py-3 bg-gradient-to-r from-[#FD366E] to-[#FF6B9D] text-white rounded-lg hover:shadow-lg hover:shadow-pink-500/30 transition-all font-medium"
                        >
                          Start Exam
                        </button>
                      ) : isExamUpcoming(exam) ? (
                        <button
                          disabled
                          className="px-6 py-3 bg-white/5 text-white/40 rounded-lg cursor-not-allowed font-medium border border-white/10"
                        >
                          Not Started
                        </button>
                      ) : (
                        <button
                          disabled
                          className="px-6 py-3 bg-white/5 text-white/40 rounded-lg cursor-not-allowed font-medium border border-white/10"
                        >
                          Ended
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="bg-white/5 border border-white/10 rounded-lg shadow p-12 text-center backdrop-blur-sm">
            <svg className="w-16 h-16 mx-auto text-white/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">
              No Completed Exams
            </h3>
            <p className="text-white/60">
              Your completed exams will appear here
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
