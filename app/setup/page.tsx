'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [roleTitle, setRoleTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [resume, setResume] = useState('')
  const [questions, setQuestions] = useState('')
  const [useDynamicQuestions, setUseDynamicQuestions] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const savedData = localStorage.getItem('interviewSetup')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setRoleTitle(parsed.roleTitle || '')
        setJobDescription(parsed.jobDescription || '')
        setResume(parsed.resume || '')
        setQuestions(parsed.questions?.join('\n') || '')
        setUseDynamicQuestions(parsed.useDynamicQuestions !== false) // Default to true
      } catch (e) {
        console.error('Failed to load saved data:', e)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!roleTitle.trim() || !jobDescription.trim()) {
      alert('Please fill in role title and job description')
      return
    }

    if (useDynamicQuestions && !resume.trim()) {
      alert('Resume is required for AI-generated questions')
      return
    }

    if (!useDynamicQuestions && !questions.trim()) {
      alert('Please provide interview questions or enable AI-generated questions')
      return
    }

    setIsLoading(true)

    try {
      let questionsList: string[] = []
      
      if (useDynamicQuestions) {
        // Generate questions from JD + resume using AI
        try {
          const response = await fetch('/api/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobDescription: jobDescription.trim(),
              resume: resume.trim(),
              roleTitle: roleTitle.trim(),
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to generate questions')
          }

          const data = await response.json()
          questionsList = data.questions || []
          
          if (questionsList.length === 0) {
            throw new Error('No questions generated')
          }
        } catch (error) {
          console.error('Error generating questions:', error)
          alert('Failed to generate questions. Please try again or use manual questions.')
          setIsLoading(false)
          return
        }
      } else {
        // Parse questions (one per line)
        questionsList = questions
          .split('\n')
          .map(q => q.trim())
          .filter(q => q.length > 0)

        if (questionsList.length === 0) {
          alert('Please provide at least one interview question')
          setIsLoading(false)
          return
        }
      }

      // Store in localStorage
      const setupData = {
        roleTitle: roleTitle.trim(),
        jobDescription: jobDescription.trim(),
        resume: resume.trim(),
        questions: questionsList,
        useDynamicQuestions,
        createdAt: new Date().toISOString(),
      }

      localStorage.setItem('interviewSetup', JSON.stringify(setupData))
      
      // Also store in sessionStorage for easy access during interview
      sessionStorage.setItem('interviewSetup', JSON.stringify(setupData))

      setIsLoading(false)
      alert('Setup saved successfully! You can now start the interview.')
      router.push('/interview')
    } catch (error) {
      console.error('Setup error:', error)
      setIsLoading(false)
      alert('An error occurred. Please try again.')
    }
  }

  return (
    <main className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-200 mb-8">Admin Setup</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Title */}
          <div>
            <label htmlFor="roleTitle" className="block text-sm font-medium text-gray-300 mb-2">
              Role Title *
            </label>
            <input
              type="text"
              id="roleTitle"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g., Senior Full-Stack Engineer"
              className="w-full px-3 py-2 bg-gray-600/40 text-gray-200/80 border text-sm rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Job Description */}
          <div>
            <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-300 mb-2">
              Job Description *
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Enter the complete job description..."
              rows={10}
              className="w-full px-3 py-2 bg-gray-600/40 text-gray-200/80 border text-sm rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Resume (for AI-generated questions) */}
          <div>
            <label htmlFor="resume" className="block text-sm font-medium text-gray-300 mb-2">
              Candidate Resume (for AI-generated questions)
            </label>
            <textarea
              id="resume"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste the candidate's resume text here..."
              rows={8}
              className="w-full px-3 py-2 bg-gray-600/40 text-gray-200/80 border text-sm rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-400">
              Required when using AI-generated questions. The AI will generate personalized questions based on the resume and job description.
            </p>
          </div>

          {/* Dynamic Questions Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useDynamicQuestions"
              checked={useDynamicQuestions}
              onChange={(e) => setUseDynamicQuestions(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="useDynamicQuestions" className="text-sm font-medium text-gray-200">
              Use AI-generated questions (from JD + Resume)
            </label>
          </div>

          {/* Interview Questions (manual mode) */}
          {!useDynamicQuestions && (
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
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter each question on a new line. Questions will be asked in order.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-2 bg-gray-600 text-white rounded-sm text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save & Start Interview'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-sm hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

