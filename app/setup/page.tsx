'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Admin Setup Page
 * 
 * Allows admin to configure:
 * - Job Description
 * - Interview Questions (one per line)
 * - Role Title
 * 
 * Data is stored in localStorage for simplicity (MVP approach).
 */
export default function SetupPage() {
  const router = useRouter()
  const [roleTitle, setRoleTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [questions, setQuestions] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Load existing data if available
  useEffect(() => {
    const savedData = localStorage.getItem('interviewSetup')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setRoleTitle(parsed.roleTitle || '')
        setJobDescription(parsed.jobDescription || '')
        setQuestions(parsed.questions || '')
      } catch (e) {
        console.error('Failed to load saved data:', e)
      }
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!roleTitle.trim() || !jobDescription.trim() || !questions.trim()) {
      alert('Please fill in all fields')
      return
    }

    setIsLoading(true)

    // Parse questions (one per line)
    const questionsList = questions
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0)

    if (questionsList.length === 0) {
      alert('Please provide at least one interview question')
      setIsLoading(false)
      return
    }

    // Store in localStorage
    const setupData = {
      roleTitle: roleTitle.trim(),
      jobDescription: jobDescription.trim(),
      questions: questionsList,
      createdAt: new Date().toISOString(),
    }

    localStorage.setItem('interviewSetup', JSON.stringify(setupData))
    
    // Also store in sessionStorage for easy access during interview
    sessionStorage.setItem('interviewSetup', JSON.stringify(setupData))

    setIsLoading(false)
    alert('Setup saved successfully! You can now start the interview.')
    router.push('/interview')
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Admin Setup</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Title */}
          <div>
            <label htmlFor="roleTitle" className="block text-sm font-medium text-gray-700 mb-2">
              Role Title *
            </label>
            <input
              type="text"
              id="roleTitle"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g., Senior Full-Stack Engineer"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Job Description */}
          <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-2">
              Job Description *
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Enter the complete job description..."
              rows={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Interview Questions */}
          <div>
            <label htmlFor="questions" className="block text-sm font-medium text-gray-700 mb-2">
              Interview Questions (one per line) *
            </label>
            <textarea
              id="questions"
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Question 1&#10;Question 2&#10;Question 3..."
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              Enter each question on a new line. Questions will be asked in order.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save & Start Interview'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

