import { NextRequest, NextResponse } from 'next/server'
import type { FinalEvaluationRequest, EvaluationResult, InterviewBlueprint } from '@/types/interview'

/**
 * Final Evaluation API Route
 * 
 * ARCHITECTURE PURPOSE:
 * This endpoint performs holistic evaluation of the complete interview transcript.
 * It's separate from per-question logic to allow comprehensive analysis of:
 * - Overall candidate fit
 * - Consistency across answers
 * - Depth of understanding
 * - Alignment with job requirements
 * 
 * WHY SEPARATE FROM PER-QUESTION LOGIC:
 * - Evaluation requires full context, not just individual answers
 * - Allows comparison across different question topics
 * - Can identify patterns (e.g., candidate strong in X but weak in Y)
 * - More accurate scoring when considering entire conversation
 * 
 * POST /api/final-evaluation
 */
export async function POST(request: NextRequest) {
  try {
    const body: FinalEvaluationRequest = await request.json()
    const { jobDescription, resume, roleTitle, conversation_history, blueprint } = body

    // Validate input
    if (!jobDescription || !resume || !roleTitle || !conversation_history || conversation_history.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields or empty conversation history' },
        { status: 400 }
      )
    }

    // Perform evaluation using Gemini
    const evaluation = await evaluateInterviewWithGemini({
      jobDescription,
      resume,
      roleTitle,
      conversation_history,
      blueprint,
    })

    return NextResponse.json(evaluation)
  } catch (error) {
    console.error('Final evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate interview' },
      { status: 500 }
    )
  }
}

/**
 * Evaluate Interview with Gemini
 * 
 * ARCHITECTURE DECISION:
 * Uses structured JSON output with strict validation. The prompt explicitly
 * requests JSON format matching the EvaluationResult interface.
 * 
 * EVALUATION CRITERIA:
 * 1. Technical alignment with JD
 * 2. Problem-solving mindset
 * 3. Communication clarity
 * 4. Depth of understanding
 * 5. Consistency between resume claims and interview responses
 * 6. Overall fit for the role
 */
async function evaluateInterviewWithGemini(
  data: FinalEvaluationRequest
): Promise<EvaluationResult> {
  const { jobDescription, resume, roleTitle, conversation_history, blueprint } = data

  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  // Build conversation transcript
  const conversationText = conversation_history
    .map((qa, idx) => {
      const typeLabel = qa.questionType === 'followup' ? ' (Follow-up)' : ''
      return `Q${idx + 1}${typeLabel}: ${qa.question}\nA${idx + 1}: ${qa.answer}`
    })
    .join('\n\n')

  const prompt = `You are a senior hiring interviewer evaluating a candidate for a ${roleTitle} position.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

${blueprint ? `Interview Blueprint Context:
- Key Skills Assessed: ${blueprint.key_skills.join(', ')}
- Focus Areas: ${blueprint.focus_areas.join(', ')}
` : ''}

Complete Interview Transcript:
${conversationText}

Evaluate the candidate holistically across the entire interview. Consider:

1. TECHNICAL ALIGNMENT: How well do their answers align with job requirements?
2. PROBLEM-SOLVING: Quality of problem-solving approach and examples
3. COMMUNICATION: Clarity, structure, and effectiveness of communication
4. DEPTH: Depth of understanding demonstrated in answers
5. CONSISTENCY: Alignment between resume claims and interview responses
6. OVERALL FIT: Overall suitability for the role

Return STRICT JSON only (no markdown, no code blocks):
{
  "alignment_percentage": number (0-100),
  "technical_score": number (0-10),
  "problem_solving_score": number (0-10),
  "communication_score": number (0-10),
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "final_verdict": "Fit" | "Maybe" | "Reject",
  "summary": "comprehensive evaluation summary (2-3 sentences)"
}

Ensure:
- alignment_percentage is 0-100
- All scores are 0-10
- strengths and weaknesses are arrays of strings
- final_verdict is exactly one of: "Fit", "Maybe", "Reject"
- summary is a string`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    // Clean and parse JSON
    const cleanedText = cleanJsonResponse(text)
    const parsed = JSON.parse(cleanedText)

    // Validate and sanitize response
    const evaluation: EvaluationResult = {
      alignment_percentage: Math.max(0, Math.min(100, Number(parsed.alignment_percentage) || 0)),
      technical_score: Math.max(0, Math.min(10, Number(parsed.technical_score) || 0)),
      problem_solving_score: Math.max(0, Math.min(10, Number(parsed.problem_solving_score) || 0)),
      communication_score: Math.max(0, Math.min(10, Number(parsed.communication_score) || 0)),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s: any) => typeof s === 'string') : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((w: any) => typeof w === 'string') : [],
      final_verdict: ['Fit', 'Maybe', 'Reject'].includes(parsed.final_verdict) 
        ? parsed.final_verdict as 'Fit' | 'Maybe' | 'Reject'
        : 'Maybe',
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Evaluation completed.',
    }

    return evaluation
  } catch (error) {
    console.error('Error parsing evaluation response:', error)
    // Return fallback evaluation
    return getFallbackEvaluation(conversation_history.length)
  }
}

/**
 * Clean JSON Response
 * Utility to extract JSON from Gemini's response
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  }
  
  if (cleaned.includes('{')) {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      cleaned = match[0]
    }
  }
  
  return cleaned.trim()
}

/**
 * Fallback Evaluation
 * 
 * ARCHITECTURE DECISION:
 * If Gemini fails or returns invalid data, we provide a generic evaluation.
 * This ensures the interview result page can still display something meaningful.
 */
function getFallbackEvaluation(answerCount: number): EvaluationResult {
  return {
    alignment_percentage: 65,
    technical_score: 7,
    problem_solving_score: 6,
    communication_score: 7,
    strengths: [
      'Demonstrates engagement with interview questions',
      'Provided responses to all questions',
    ],
    weaknesses: [
      'Evaluation data incomplete - manual review recommended',
    ],
    final_verdict: 'Maybe',
    summary: `The candidate completed the interview with ${answerCount} question${answerCount !== 1 ? 's' : ''}. Due to technical limitations, a comprehensive automated evaluation could not be completed. Manual review of the interview transcript is recommended.`,
  }
}

