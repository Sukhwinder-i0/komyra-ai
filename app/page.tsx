import Link from 'next/link'

/**
 * Landing Page
 * 
 * Brief explanation of the platform and entry point for both
 * admin setup and candidate interview flows.
 */
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Komyra AI Interview Platform
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          An AI-powered interview platform that evaluates candidates through
          speech-based interviews. Get instant feedback on technical alignment,
          problem-solving skills, and communication clarity.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/setup"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Admin Setup
          </Link>
          <Link
            href="/interview"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Start Interview
          </Link>
        </div>
      </div>
    </main>
  )
}

