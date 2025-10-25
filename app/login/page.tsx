'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') {
      setIsDark(false)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Get user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    console.log('User ID:', data.user.id)
    console.log('Profile data:', profile)
    console.log('Profile error:', profileError)

    // Redirect based on role
    const role = profile?.role || 'student'
    console.log('User role:', role)
    console.log('Redirecting to:', role === 'admin' ? '/admin' : '/dashboard')
    
    setLoading(false)
    
    // Use router.replace instead of push to avoid history issues
    if (role === 'admin') {
      router.replace('/admin')
    } else {
      router.replace('/dashboard')
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${isDark ? 'bg-[#19191C]' : 'bg-white'} p-4`}>
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2 rounded-lg transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
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
      <div className={`max-w-md w-full space-y-6 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'} border p-8 rounded-2xl backdrop-blur-sm`}>
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FD366E] to-[#FF6B9D] rounded-lg flex items-center justify-center shadow-lg shadow-pink-500/20">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className={`font-bold text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>ExamProctor</span>
          </div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
            Sign in to your account
          </h2>
          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            Or{' '}
            <Link
              href="/signup"
              className="font-medium text-[#FD366E] hover:text-[#FF6B9D] transition-colors"
            >
              create a new account
            </Link>
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleEmailLogin}>
          {error && (
            <div className={`rounded-lg ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'} border p-3`}>
              <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'} mb-1.5`}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`block w-full px-4 py-2.5 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-white/40' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FD366E] focus:border-transparent transition-all`}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'} mb-1.5`}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`block w-full px-4 py-2.5 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-white/40' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FD366E] focus:border-transparent transition-all`}
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#FD366E] to-[#FF6B9D] hover:shadow-lg hover:shadow-pink-500/30 focus:outline-none focus:ring-2 focus:ring-[#FD366E] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${isDark ? 'border-white/10' : 'border-gray-300'}`}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${isDark ? 'bg-[#19191C] text-white/60' : 'bg-white text-gray-600'}`}>Or continue with</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-3 py-3 px-4 border ${isDark ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'} rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FD366E] disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
