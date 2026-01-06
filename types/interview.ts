/**
 * Type definitions for interview data structures
 */

export interface InterviewSetup {
  roleTitle: string
  jobDescription: string
  questions: string[]
  createdAt: string
}

export interface InterviewAnswer {
  question: string
  answer: string
  timestamp: string
}

export interface EvaluationResult {
  alignment_percentage: number
  technical_score: number
  problem_solving_score: number
  communication_score: number
  strengths: string[]
  weaknesses: string[]
  final_verdict: 'Fit' | 'Maybe' | 'Reject'
  summary: string
}

export interface EvaluationRequest {
  jobDescription: string
  questions: string[]
  answers: InterviewAnswer[]
}

