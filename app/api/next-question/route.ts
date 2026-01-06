import { NextRequest, NextResponse } from 'next/server'
import type { NextQuestionRequest, NextQuestionResponse, InterviewState, InterviewBlueprint } from '@/types/interview'

/**
 * Next Question API Route
 * 
 * ARCHITECTURE PURPOSE:
 * Unified endpoint for generating both main questions and follow-ups.
 * This replaces the previous separate endpoints (generate-questions, follow-up)
 * with a single stateful API that understands interview context.
 * 
 * WHY UNIFIED:
 * - Single source of truth for question generation logic
 * - Maintains conversation context across all questions
 * - Simpler client-side state management
 * - Easier to implement progressive depth (start broad, go deeper)
 * 
 * DECISION FLOW:
 * 1. If no last_answer: Generate next main question
 * 2. If last_answer exists: Decide follow-up vs next main question
 * 3. Respect max_questions and max_followups limits
 * 4. Return updated state to keep client/server in sync
 * 
 * POST /api/next-question
 */
export async function POST(request: NextRequest) {
  try {
    const body: NextQuestionRequest = await request.json()
    const { jobDescription, resume, roleTitle, interview_state, last_answer, blueprint } = body

    // Validate input
    if (!jobDescription || !resume || !roleTitle || !interview_state) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if interview is complete
    if (interview_state.interview_phase === 'completed') {
      return NextResponse.json({
        question: null,
        question_id: '',
        question_type: 'main',
        updated_state: interview_state,
        interview_complete: true,
      } as NextQuestionResponse)
    }

    // Generate next question using Gemini
    const response = await generateNextQuestion({
      jobDescription,
      resume,
      roleTitle,
      interview_state,
      last_answer,
      blueprint,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Next question error:', error)
    return NextResponse.json(
      { error: 'Failed to generate next question' },
      { status: 500 }
    )
  }
}

/**
 * Generate Next Question
 * 
 * ARCHITECTURE DECISION:
 * This function implements the core logic for question generation:
 * 
 * 1. MAIN QUESTIONS: Generated when moving to a new topic
 *    - Uses blueprint to focus on key skills/gaps
 *    - Progressively deeper (early questions broad, later ones specific)
 *    - Resume-aware and JD-aligned
 * 
 * 2. FOLLOW-UP QUESTIONS: Generated after an answer
 *    - Only if answer needs clarification or deeper exploration
 *    - Respects max_followups limit
 *    - Contextually relevant to the main question
 * 
 * 3. STATE MANAGEMENT: Updates interview state atomically
 *    - Increments question_index for main questions
 *    - Increments followup_count for follow-ups
 *    - Marks interview complete when limits reached
 */
async function generateNextQuestion(
  data: NextQuestionRequest
): Promise<NextQuestionResponse> {
  const { jobDescription, resume, roleTitle, interview_state, last_answer, blueprint } = data

  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  // Build conversation context
  const conversationText = interview_state.conversation_history
    .map((qa, idx) => `Q${idx + 1} (${qa.questionType || 'main'}): ${qa.question}\nA${idx + 1}: ${qa.answer}`)
    .join('\n\n')

  // Determine if we should ask a follow-up or move to next main question
  const shouldAskFollowUp = last_answer && 
                            interview_state.followup_count < interview_state.max_followups &&
                            interview_state.question_type === 'main'

  // Build prompt based on question type
  let prompt: string
  let questionType: 'main' | 'followup'

  if (shouldAskFollowUp) {
    // FOLLOW-UP QUESTION PROMPT
    questionType = 'followup'
    const lastMainQuestion = interview_state.conversation_history
      .filter(qa => qa.mainQuestionIndex === interview_state.current_question_index)
      .find(qa => qa.questionType === 'main') || interview_state.conversation_history[interview_state.conversation_history.length - 1]

    prompt = `You are an expert technical interviewer conducting a ${roleTitle} interview.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

${blueprint ? `Interview Blueprint:
- Key Skills to Validate: ${blueprint.key_skills.join(', ')}
- Skill Gaps to Explore: ${blueprint.skill_gaps.join(', ')}
- Focus Areas: ${blueprint.focus_areas.join(', ')}
` : ''}

Conversation so far:
${conversationText}

The candidate just answered: "${last_answer}"

Analyze the answer and decide:
1. Does it need clarification or deeper exploration?
2. Are there interesting points worth following up on?
3. Would a follow-up question add value?

If YES, generate ONE concise follow-up question (max 20 words).
If NO, return null.

Return STRICT JSON only:
{
  "question": "follow-up question or null",
  "reasoning": "brief explanation"
}`

  } else {
    // MAIN QUESTION PROMPT
    questionType = 'main'
    const questionNumber = interview_state.current_question_index + 1
    const totalQuestions = interview_state.max_questions

    prompt = `You are an expert technical interviewer conducting a ${roleTitle} interview.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

${blueprint ? `Interview Blueprint:
- Key Skills to Validate: ${blueprint.key_skills.join(', ')}
- Skill Gaps to Explore: ${blueprint.skill_gaps.join(', ')}
- Notable Projects: ${blueprint.notable_projects.join(', ')}
- Focus Areas: ${blueprint.focus_areas.join(', ')}
- Question Themes: ${blueprint.suggested_question_themes.join(', ')}
` : ''}

Conversation so far (${interview_state.conversation_history.length} questions asked):
${conversationText || 'No questions asked yet.'}

Generate question ${questionNumber} of ${totalQuestions}.

Guidelines:
- ${questionNumber === 1 ? 'Start with a broad, welcoming question about their background.' : ''}
- ${questionNumber <= 3 ? 'Focus on experience and general fit.' : 'Go deeper into technical specifics.'}
- ${questionNumber > 5 ? 'Explore edge cases, problem-solving depth, or advanced topics.' : ''}
- Be specific to the candidate's resume and job requirements
- Avoid repeating topics already covered
- Keep question concise (max 25 words)

Return STRICT JSON only:
{
  "question": "the interview question",
  "reasoning": "why this question was chosen"
}`

  }

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    // Clean and parse JSON
    const cleanedText = cleanJsonResponse(text)
    const parsed = JSON.parse(cleanedText)

    const question = parsed.question || null
    const reasoning = parsed.reasoning || ''

    // Update interview state
    const updatedState: InterviewState = { ...interview_state }

    if (questionType === 'followup' && question) {
      // Follow-up question
      updatedState.followup_count += 1
      updatedState.question_type = 'followup'
      updatedState.current_question_id = `followup-${interview_state.current_question_index}-${Date.now()}`
    } else if (questionType === 'main' && question) {
      // Main question
      updatedState.current_question_index += 1
      updatedState.followup_count = 0 // Reset follow-up count
      updatedState.question_type = 'main'
      updatedState.current_question_id = `main-${updatedState.current_question_index}-${Date.now()}`
    }

    // Check if interview should complete
    const isComplete = !question || 
                       (questionType === 'main' && updatedState.current_question_index >= updatedState.max_questions)

    if (isComplete) {
      updatedState.interview_phase = 'completed'
    } else {
      updatedState.interview_phase = 'in_progress'
    }

    return {
      question,
      question_id: updatedState.current_question_id || '',
      question_type: questionType,
      updated_state: updatedState,
      interview_complete: isComplete,
      reasoning,
    }
  } catch (error) {
    console.error('Error parsing Gemini response:', error)
    // Fallback: return next question or mark complete
    const updatedState: InterviewState = {
      ...interview_state,
      interview_phase: interview_state.current_question_index >= interview_state.max_questions ? 'completed' : 'in_progress',
    }

    return {
      question: updatedState.current_question_index < updatedState.max_questions 
        ? `Tell me about your experience relevant to this ${roleTitle} position.`
        : null,
      question_id: `fallback-${Date.now()}`,
      question_type: 'main',
      updated_state: updatedState,
      interview_complete: updatedState.interview_phase === 'completed',
      reasoning: 'Fallback question due to API error',
    }
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

