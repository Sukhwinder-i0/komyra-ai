import { NextRequest, NextResponse } from 'next/server'
import type { EvaluationRequest, EvaluationResult } from '@/types/interview'

/**
 * Evaluation API Route
 * 
 * Accepts interview data (JD, questions, answers) and evaluates
 * the candidate using Gemini API (placeholder implementation).
 * 
 * POST /api/evaluate
 */
export async function POST(request: NextRequest) {
  try {
    const body: EvaluationRequest = await request.json()
    const { jobDescription, questions, answers, resume } = body

    // Validate input
    if (!jobDescription || !questions || !answers || answers.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: jobDescription, questions, or answers' },
        { status: 400 }
      )
    }

    // Call evaluation function
    const evaluation = await evaluateCandidate({
      jobDescription,
      questions,
      answers,
      resume,
    })

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error('Evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate candidate' },
      { status: 500 }
    )
  }
}

/**
 * Evaluate Candidate Function
 * 
 * This function contains the Gemini API integration logic.
 * Currently uses a placeholder/mock response.
 * 
 * TODO: Replace with actual Gemini API call
 * 
 * @param data - Interview data including JD, questions, and answers
 * @returns Evaluation result with scores and feedback
 */
async function evaluateCandidate(data: EvaluationRequest): Promise<EvaluationResult> {
  const { jobDescription, questions, answers, resume } = data

  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
  
  const prompt = buildEvaluationPrompt(jobDescription, questions, answers, resume)
  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text().trim()
  
  // Clean up the response - remove markdown code blocks if present
  let cleanedText = text
  if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  }
  if (cleanedText.includes('{')) {
    const match = cleanedText.match(/\{[\s\S]*\}/)
    if (match) {
      cleanedText = match[0]
    }
  }
  
  try {
    return JSON.parse(cleanedText)
  } catch (parseError) {
    console.error('Error parsing evaluation response:', parseError)
    // Fallback to mock evaluation if parsing fails
    return getMockEvaluation(answers)
  }

}

/**
 * Build Evaluation Prompt for Gemini
 * 
 * Constructs a well-structured prompt for the Gemini API
 * to evaluate the candidate based on JD, questions, and answers.
 * 
 * @param jobDescription - The job description
 * @param questions - Array of interview questions
 * @param answers - Array of candidate answers
 * @returns Formatted prompt string
 */
function buildEvaluationPrompt(
  jobDescription: string,
  questions: string[],
  answers: Array<{ question: string; answer: string; timestamp: string }>,
  resume?: string
): string {
  const qaPairs = answers.map((qa, i) => {
    return `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`
  }).join('\n\n')

  let prompt = `You are a senior hiring interviewer.

Evaluate the candidate based on:
- Job Description
- Interview Questions & Answers
${resume ? '- Candidate Resume' : ''}

Job Description:
${jobDescription}
${resume ? `\nCandidate Resume:\n${resume}` : ''}

Interview Q&A:
${qaPairs}

Evaluate across:
1. Technical alignment with JD
2. Problem-solving mindset
3. Communication clarity
4. Depth of understanding
5. Practical experience signals
${resume ? '6. Consistency between resume claims and interview responses' : ''}

Return STRICT JSON (no markdown, no code blocks, just valid JSON):
{
  "alignment_percentage": number (0-100),
  "technical_score": number (0-10),
  "problem_solving_score": number (0-10),
  "communication_score": number (0-10),
  "strengths": string[],
  "weaknesses": string[],
  "final_verdict": "Fit" | "Maybe" | "Reject",
  "summary": string
}`

  return prompt
}

function getMockEvaluation(answers: Array<{ question: string; answer: string; timestamp: string }>): EvaluationResult {
  return {
    alignment_percentage: Math.floor(Math.random() * 40) + 60, 
    technical_score: Math.floor(Math.random() * 3) + 7, 
    problem_solving_score: Math.floor(Math.random() * 3) + 6,
    communication_score: Math.floor(Math.random() * 3) + 7,
    strengths: [
      'Demonstrates strong technical knowledge',
      'Clear communication style',
      'Shows practical problem-solving approach',
    ],
    weaknesses: [
      'Could provide more specific examples',
      'Some answers lacked depth',
    ],
    final_verdict: ['Fit', 'Maybe', 'Reject'][Math.floor(Math.random() * 3)] as 'Fit' | 'Maybe' | 'Reject',
    summary: `The candidate shows ${answers.length > 0 ? 'good' : 'limited'} engagement with the interview questions. Based on the responses provided, there are both strengths and areas for improvement. The evaluation considers technical alignment with the job description, problem-solving capabilities, and communication clarity.`,
  }
}

