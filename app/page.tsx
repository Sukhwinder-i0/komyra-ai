import Link from 'next/link'

/**
 * Landing Page
 * 
 * Brief explanation of the platform and entry point for both
 * admin setup and candidate interview flows.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-4xl font-bold text-gray-200 mb-6">
          Komyra AI Interview Platform
        </h1>
        <p className="text-md text-gray-400 mb-8">
          An AI-powered interview platform that evaluates candidates through
          speech-based interviews. Get instant feedback on technical alignment,
          problem-solving skills, and communication clarity.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/setup"
            className="px-3 py-2 bg-gray-400/50 text-white text-xs rounded-sm hover:bg-gray-500/40 transition-colors font-medium"
          >
            Admin Setup
          </Link>
          <Link
            href="/interview"
            className="px-3 py-2 bg-gray-100 rounded-sm text-xs hover:bg-gray-200/90 transition-colors font-medium"
          >
            Start Interview
          </Link>
        </div>
      </div>
    </main>
  )
}

