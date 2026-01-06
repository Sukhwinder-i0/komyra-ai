/**
 * Interview State Controller
 * 
 * ARCHITECTURE PURPOSE:
 * This utility provides centralized state management for the interview flow.
 * It encapsulates the logic for:
 * - Initializing interview state
 * - Updating state based on API responses
 * - Validating state transitions
 * - Managing question/follow-up limits
 * 
 * WHY THIS EXISTS:
 * - Single source of truth for interview state logic
 * - Prevents state inconsistencies between client and server
 * - Makes state transitions explicit and testable
 * - Provides clear defaults and validation
 */

import type { InterviewState, InterviewAnswer } from '@/types/interview'

/**
 * Create Initial Interview State
 * 
 * ARCHITECTURE DECISION:
 * Default limits are:
 * - max_questions: 6-8 (enough to cover key areas, not too long)
 * - max_followups: 2 (allows depth without infinite loops)
 * 
 * These can be adjusted per-interview if needed, but defaults work for most cases.
 */
export function createInitialInterviewState(
  maxQuestions: number = 7,
  maxFollowups: number = 2
): InterviewState {
  return {
    current_question_index: 0,
    question_type: 'main',
    followup_count: 0,
    max_questions: maxQuestions,
    max_followups: maxFollowups,
    interview_phase: 'initializing',
    current_question_id: undefined,
    conversation_history: [],
  }
}

/**
 * Add Answer to Interview State
 * 
 * ARCHITECTURE NOTE:
 * This function creates an InterviewAnswer with proper metadata:
 * - questionType: tracks if it's a main or follow-up
 * - mainQuestionIndex: for follow-ups, tracks which main question they relate to
 * - questionId: unique identifier for tracking
 * 
 * This metadata is crucial for:
 * - Follow-up question generation (knowing which main question to follow up on)
 * - Evaluation (understanding question context)
 * - Analytics (tracking question patterns)
 */
export function addAnswerToState(
  state: InterviewState,
  question: string,
  answer: string,
  questionId?: string
): InterviewState {
  const answerRecord: InterviewAnswer = {
    question,
    answer,
    timestamp: new Date().toISOString(),
    questionId: questionId || state.current_question_id,
    questionType: state.question_type,
    mainQuestionIndex: state.question_type === 'followup' 
      ? state.current_question_index 
      : undefined,
  }

  return {
    ...state,
    conversation_history: [...state.conversation_history, answerRecord],
  }
}

/**
 * Update State from Next Question Response
 * 
 * ARCHITECTURE DECISION:
 * This function applies the server's state update to the client state.
 * The server is the source of truth for state transitions because:
 * - Server decides when to ask follow-ups vs next main question
 * - Server enforces max_questions and max_followups limits
 * - Server tracks interview completion
 * 
 * Client just applies the update atomically.
 */
export function updateStateFromResponse(
  currentState: InterviewState,
  serverState: InterviewState
): InterviewState {
  // Validate state transition
  if (serverState.interview_phase === 'completed' && currentState.interview_phase !== 'completed') {
    // Interview just completed
    return {
      ...serverState,
      interview_phase: 'completed',
    }
  }

  // Apply server state update
  return {
    ...serverState,
    // Preserve conversation_history from current state (it may have the latest answer)
    conversation_history: currentState.conversation_history,
  }
}

/**
 * Check if Interview Can Continue
 * 
 * ARCHITECTURE UTILITY:
 * Quick check to see if interview should continue or is complete.
 * Used for UI state (e.g., disabling "Next Question" button).
 */
export function canContinueInterview(state: InterviewState): boolean {
  return (
    state.interview_phase !== 'completed' &&
    state.current_question_index < state.max_questions
  )
}

/**
 * Get Interview Progress
 * 
 * ARCHITECTURE UTILITY:
 * Returns progress percentage for UI display.
 * Calculated based on current question index vs max questions.
 */
export function getInterviewProgress(state: InterviewState): number {
  if (state.max_questions === 0) return 0
  return Math.min(100, Math.round((state.current_question_index / state.max_questions) * 100))
}

/**
 * Get Current Question Context
 * 
 * ARCHITECTURE UTILITY:
 * Returns metadata about the current question for debugging/logging.
 */
export function getQuestionContext(state: InterviewState): {
  questionNumber: number
  totalQuestions: number
  followupCount: number
  maxFollowups: number
  isFollowUp: boolean
} {
  return {
    questionNumber: state.current_question_index + 1,
    totalQuestions: state.max_questions,
    followupCount: state.followup_count,
    maxFollowups: state.max_followups,
    isFollowUp: state.question_type === 'followup',
  }
}

