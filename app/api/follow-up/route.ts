import { NextRequest, NextResponse } from 'next/server'
import type { FollowUpRequest, FollowUpResponse } from '@/types/interview'

/**
 * Follow-up Question API Route
 * 
 * Generates follow-up questions based on conversation history
 * 
 * POST /api/follow-up
 */
export async function POST(request: NextRequest) {
  try {
    const body: FollowUpRequest = await request.json()
    const { jobDescription, resume, conversationHistory, currentQuestionIndex } = body

    // Validate input
    if (!jobDescription || !resume || !conversationHistory || conversationHistory.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate follow-up question
    const followUp = await generateFollowUpQuestion({
      jobDescription,
      resume,
      conversationHistory,
      currentQuestionIndex,
    })

    return NextResponse.json(followUp)
  } catch (error) {
    console.error('Follow-up error:', error)
    return NextResponse.json(
      { error: 'Failed to generate follow-up question' },
      { status: 500 }
    )
  }
}

/**
 * Generate Follow-up Question Function
 * 
 * Uses Gemini API to determine if a follow-up question is needed
 * and generates it based on the candidate's answer
 */
async function generateFollowUpQuestion(
  data: FollowUpRequest
): Promise<FollowUpResponse> {
  const { jobDescription, resume, conversationHistory, currentQuestionIndex } = data

  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  // Build conversation context
  const conversationText = conversationHistory
    .map((qa, idx) => `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`)
    .join('\n\n')

  const lastQA = conversationHistory[conversationHistory.length - 1]

  const prompt = `You are an expert technical interviewer conducting an interview for a position.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

Conversation so far:
${conversationText}

The candidate just answered the last question. Analyze their answer and determine:
1. If the answer needs clarification or deeper exploration
2. If a follow-up question would be valuable
3. What specific follow-up question would be most insightful

Guidelines:
- Ask follow-ups if the answer was vague, incomplete, or needs more detail
- Ask follow-ups to explore interesting points they mentioned
- Ask follow-ups to test deeper understanding
- Skip follow-ups if the answer was comprehensive and clear
- Keep follow-up questions concise and focused

Return STRICT JSON (no markdown, no code blocks, just valid JSON):
{
  "followUpQuestion": "string or null",
  "shouldContinue": boolean,
  "reasoning": "brief explanation"
}

If no follow-up is needed, set followUpQuestion to null and shouldContinue to true.
If a follow-up is needed, provide the question and set shouldContinue to false.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    // Clean up the response
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

    const parsed = JSON.parse(cleanedText)

    return {
      followUpQuestion: parsed.followUpQuestion || null,
      shouldContinue: parsed.shouldContinue !== false,
      questionId: `followup-${currentQuestionIndex}-${Date.now()}`,
    }
  } catch (error) {
    console.error('Error parsing follow-up response:', error)
    // Default: no follow-up, continue to next question
    return {
      followUpQuestion: null,
      shouldContinue: true,
      questionId: `followup-${currentQuestionIndex}-${Date.now()}`,
    }
  }
}

