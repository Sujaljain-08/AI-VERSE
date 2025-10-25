'use client';

import Link from 'next/link'


export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6 sm:p-12">
        <div className="max-w-6xl w-full">
          
          {/* Hero Section */}
          <div className="text-center mb-16 space-y-6 animate-fade-in">
            <div className="inline-block">
              <span className="px-4 py-2 bg-gradient-to-r from-purple-400 to-pink-400 text-white text-sm font-bold rounded-full shadow-lg animate-pulse">
                🚀 AI-POWERED PROCTORING
              </span>
            </div>
            
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-pink-200 animate-gradient leading-tight">
              Exam Proctoring
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
                Reimagined
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-purple-100 max-w-3xl mx-auto font-light">
              Real-time AI monitoring • Instant cheat detection • Live admin view
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20 animate-slide-up">
            <Link
              href="/login"
              className="group relative px-10 py-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-bold rounded-2xl overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <span className="relative z-10">Sign In →</span>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </Link>
            <Link
              href="/signup"
              className="group relative px-10 py-5 bg-white/10 backdrop-blur-lg text-white text-lg font-bold rounded-2xl border-2 border-white/30 overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:bg-white/20"
            >
              <span className="relative z-10">Get Started ✨</span>
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8 animate-fade-in-delayed">
            {/* Card 1 - Students */}
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:border-purple-400/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="text-5xl mb-4 animate-bounce-slow">🎓</div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  For Students
                </h2>
                <p className="text-purple-200 leading-relaxed">
                  Secure exam experience with AI-powered monitoring. Fair, transparent, and stress-free testing environment.
                </p>
              </div>
            </div>

            {/* Card 2 - Admins */}
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:border-pink-400/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="text-5xl mb-4 animate-bounce-slow animation-delay-1000">👨‍💼</div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  For Admins
                </h2>
                <p className="text-purple-200 leading-relaxed">
                  Real-time dashboard with live video feeds, cheat detection alerts, and comprehensive analytics.
                </p>
              </div>
            </div>

            {/* Card 3 - AI Powered */}
            <div className="group relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:border-yellow-400/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="text-5xl mb-4 animate-bounce-slow animation-delay-2000">🤖</div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  AI Powered
                </h2>
                <p className="text-purple-200 leading-relaxed">
                  Advanced ML algorithms detect suspicious behavior, facial recognition, and device usage automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">99.9%</div>
              <div className="text-purple-200 text-sm mt-2">Detection Accuracy</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">30fps</div>
              <div className="text-purple-200 text-sm mt-2">Real-time Analysis</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">Live</div>
              <div className="text-purple-200 text-sm mt-2">Admin Monitoring</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">24/7</div>
              <div className="text-purple-200 text-sm mt-2">System Uptime</div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-12 text-center">
            <p className="text-purple-300 text-sm">
              🔒 Secure • 🎯 Accurate • ⚡ Fast • 🌟 Trusted by thousands
            </p>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
        .animate-fade-in-delayed {
          animation: fade-in 1s ease-out 0.3s both;
        }
        .animate-slide-up {
          animation: slide-up 1s ease-out 0.2s both;
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
