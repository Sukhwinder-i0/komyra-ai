'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { InterviewSetup, InterviewAnswer, EvaluationResult } from '@/types/interview'

/**
 * Result Page
 * 
 * Displays the evaluation report after interview completion.
 * Shows scores, strengths, weaknesses, and final verdict.
 */
export default function ResultPage() {
  const router = useRouter()
  const [setup, setSetup] = useState<InterviewSetup | null>(null)
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load setup and answers from sessionStorage
    const savedSetup = sessionStorage.getItem('interviewSetup') || localStorage.getItem('interviewSetup')
    const savedAnswers = sessionStorage.getItem('interviewAnswers')

    if (!savedSetup) {
      alert('No interview setup found')
      router.push('/setup')
      return
    }

    if (!savedAnswers) {
      alert('No interview answers found')
      router.push('/interview')
      return
    }

    try {
      const parsedSetup = JSON.parse(savedSetup)
      const parsedAnswers = JSON.parse(savedAnswers)
      
      setSetup(parsedSetup)
      setAnswers(parsedAnswers)

      // Call evaluation API
      evaluateInterview(parsedSetup, parsedAnswers)
    } catch (e) {
      console.error('Failed to parse data:', e)
      setError('Failed to load interview data')
      setIsLoading(false)
    }
  }, [router])

  const evaluateInterview = async (setupData: InterviewSetup, answersData: InterviewAnswer[]) => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobDescription: setupData.jobDescription,
          questions: setupData.questions,
          answers: answersData,
        }),
      })

      if (!response.ok) {
        throw new Error('Evaluation failed')
      }

      const result: EvaluationResult = await response.json()
      setEvaluation(result)
    } catch (e) {
      console.error('Evaluation error:', e)
      setError('Failed to evaluate interview. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'Fit':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Maybe':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'Reject':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Evaluating interview...</p>
        </div>
      </main>
    )
  }

  if (error || !evaluation) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load evaluation'}</p>
          <button
            onClick={() => router.push('/interview')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Interview Evaluation Report</h1>
          {setup && (
            <p className="text-lg text-gray-600">Role: {setup.roleTitle}</p>
          )}
        </div>

        {/* Alignment Percentage */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Overall Alignment</h2>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-700 font-medium">Alignment with Job Description</span>
              <span className="text-gray-900 font-bold text-xl">
                {evaluation.alignment_percentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className={`h-6 rounded-full transition-all ${
                  evaluation.alignment_percentage >= 80
                    ? 'bg-green-600'
                    : evaluation.alignment_percentage >= 60
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${evaluation.alignment_percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Technical Score</h3>
            <p className="text-3xl font-bold text-blue-600">{evaluation.technical_score}/10</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Problem Solving</h3>
            <p className="text-3xl font-bold text-purple-600">{evaluation.problem_solving_score}/10</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Communication</h3>
            <p className="text-3xl font-bold text-green-600">{evaluation.communication_score}/10</p>
          </div>
        </div>

        {/* Final Verdict */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Final Verdict</h2>
          <div
            className={`inline-block px-6 py-3 rounded-lg border-2 font-bold text-lg ${getVerdictColor(
              evaluation.final_verdict
            )}`}
          >
            {evaluation.final_verdict}
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-700">Strengths</h2>
            <ul className="space-y-2">
              {evaluation.strengths.map((strength, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-700">Areas for Improvement</h2>
            <ul className="space-y-2">
              {evaluation.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-600 mr-2">•</span>
                  <span className="text-gray-700">{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Summary</h2>
          <p className="text-gray-700 leading-relaxed">{evaluation.summary}</p>
        </div>

        {/* Q&A Review */}
        {setup && answers.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Question & Answer Review</h2>
            <div className="space-y-6">
              {setup.questions.map((question, index) => {
                const answer = answers[index]
                return (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Q{index + 1}: {question}
                    </h3>
                    <p className="text-gray-700 ml-4">
                      {answer?.answer || 'No answer provided'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/interview')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start New Interview
          </button>
          <button
            onClick={() => router.push('/setup')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Admin Setup
          </button>
        </div>
      </div>
    </main>
  )
}

