'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const features = [
    {
      icon: '🎯',
      title: 'AI-Powered Detection',
      description: 'Advanced machine learning algorithms monitor student behavior in real-time with 99.9% accuracy.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: '📹',
      title: 'Live Monitoring',
      description: 'Watch student exams live with WebRTC streaming and instant alert notifications for suspicious activity.',
      color: 'from-blue-600 to-indigo-600'
    },
    {
      icon: '📊',
      title: 'Analytics Dashboard',
      description: 'Comprehensive reporting with focus scores, behavior patterns, and detailed session analytics.',
      color: 'from-indigo-500 to-purple-500'
    },
    {
      icon: '🔒',
      title: 'Secure & Private',
      description: 'End-to-end encryption with role-based access control ensuring data privacy and compliance.',
      color: 'from-cyan-500 to-blue-500'
    },
    {
      icon: '⚡',
      title: 'Real-Time Analysis',
      description: 'Process video frames at 30 FPS with instant cheat detection and behavior classification.',
      color: 'from-blue-500 to-indigo-500'
    },
    {
      icon: '🎓',
      title: 'Student Friendly',
      description: 'Non-intrusive monitoring that maintains exam integrity while respecting student privacy.',
      color: 'from-indigo-600 to-blue-600'
    }
  ];

  const stats = [
    { value: '99.9%', label: 'Detection Accuracy' },
    { value: '30 FPS', label: 'Real-Time Processing' },
    { value: '<50ms', label: 'Response Time' },
    { value: '24/7', label: 'Uptime Reliability' }
  ];

  return (
    <div className="min-h-screen bg-white relative">
      {/* Dotted Pattern Background */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
        backgroundSize: '30px 30px'
      }}></div>

      {/* Navigation */}
      <nav className="relative z-50 bg-white/90 backdrop-blur-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">EP</span>
              </div>
              <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ExamProctor</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors px-4 py-2"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all font-semibold"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 border-2 border-blue-200 mb-8 shadow-sm">
              <span className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></span>
              <span className="text-sm font-semibold text-blue-700">AI-Powered Exam Monitoring</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
              Secure Online Exams with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600">
                AI Proctoring
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto">
              Advanced AI technology monitors student behavior in real-time, ensuring exam integrity while maintaining a seamless testing experience.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-blue-500/50 transition-all font-bold text-lg transform hover:scale-105"
              >
                Start Free Trial →
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 bg-white text-blue-600 rounded-xl border-2 border-blue-600 hover:bg-blue-50 transition-all font-bold text-lg"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center bg-white rounded-2xl p-6 border-2 border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">{stat.value}</div>
                <div className="text-sm font-medium text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
              Everything you need for secure exams
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive proctoring solution with advanced AI detection and real-time monitoring
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
                className="bg-white rounded-2xl p-8 border-2 border-blue-100 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 cursor-pointer group transform hover:-translate-y-1"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-3xl mb-5 transform group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simple setup, powerful monitoring, comprehensive analytics
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center text-3xl font-black text-white mx-auto mb-6 shadow-xl shadow-blue-500/30">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Create Exam</h3>
              <p className="text-gray-600 text-lg">Set up your exam with questions, duration, and monitoring preferences in minutes.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center text-3xl font-black text-white mx-auto mb-6 shadow-xl shadow-indigo-500/30">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Students Take Exam</h3>
              <p className="text-gray-600 text-lg">AI monitors student behavior via webcam, detecting suspicious activities in real-time.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center text-3xl font-black text-white mx-auto mb-6 shadow-xl shadow-cyan-500/30">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Review Results</h3>
              <p className="text-gray-600 text-lg">Access detailed reports with focus scores, flagged incidents, and video recordings.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }}></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">
            Ready to secure your exams?
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Join thousands of institutions using AI-powered proctoring
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all font-bold text-lg shadow-xl hover:scale-105"
            >
              Start Free Trial
            </Link>
            <Link
              href="/login"
              className="px-10 py-4 bg-transparent text-white rounded-xl border-2 border-white hover:bg-white/10 transition-all font-bold text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-gray-50 border-t-2 border-blue-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">EP</span>
              </div>
              <span className="font-bold text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ExamProctor</span>
            </div>
            <p className="text-gray-600 mb-6">
              AI-powered exam proctoring for secure online assessments.
            </p>
            <div className="text-sm text-gray-500">
              &copy; 2025 ExamProctor. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
