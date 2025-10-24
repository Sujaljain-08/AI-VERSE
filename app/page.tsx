import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="z-10 max-w-5xl w-full items-center justify-center">
        <h1 className="text-5xl font-extrabold text-center mb-4 text-gray-900 dark:text-white">
          Exam Proctoring System
        </h1>
        <p className="text-center text-xl mb-12 text-gray-600 dark:text-gray-300">
          AI-powered exam monitoring with real-time cheat detection
        </p>
        
        <div className="flex gap-4 justify-center mb-16">
          <Link
            href="/login"
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-8 py-3 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-600 dark:border-indigo-400 rounded-lg font-semibold hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
          >
            Sign Up
          </Link>
        </div>
        
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-8">
          New users are registered as students by default
        </p>

        <div className="mt-12 grid text-center lg:grid-cols-3 gap-6">
          <div className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-6 transition-all hover:shadow-lg">
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
              For Students
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Take exams securely with automated proctoring and real-time monitoring
            </p>
          </div>

          <div className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-6 transition-all hover:shadow-lg">
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
              For Admins
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Monitor students live, detect suspicious behavior, and manage exams efficiently
            </p>
          </div>

          <div className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-6 transition-all hover:shadow-lg">
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
              AI Powered
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Advanced ML models detect cheating patterns and suspicious activities automatically
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
