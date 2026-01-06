/**
 * Type definitions for interview data structures
 * 
 * ARCHITECTURE NOTE:
 * This type system supports both static (pre-defined) and dynamic (AI-generated) interviews.
 * The interview state controller manages the flow, ensuring questions are generated progressively
 * and follow-ups are contextually appropriate.
 */

export interface InterviewSetup {
  roleTitle: string
  jobDescription: string
  resume?: string // Optional resume text
  questions?: string[] // Optional pre-defined questions (for backward compatibility)
  createdAt: string
  useDynamicQuestions?: boolean // Flag to use AI-generated questions
  interviewBlueprint?: InterviewBlueprint // Cached blueprint from analyze-profile
}

/**
 * Interview State Controller
 * 
 * ARCHITECTURE DECISION:
 * Centralized state management for interview flow. This structure allows:
 * - Clear tracking of interview progress
 * - Controlled question generation (main vs follow-up)
 * - Limits on questions/follow-ups to prevent infinite loops
 * - Phase tracking for different interview stages
 */
export interface InterviewState {
  current_question_index: number // Index of current main question (0-based)
  question_type: 'main' | 'followup' // Type of current question
  followup_count: number // Number of follow-ups asked for current main question
  max_questions: number // Maximum main questions (default: 6-8)
  max_followups: number // Maximum follow-ups per main question (default: 2)
  interview_phase: 'initializing' | 'in_progress' | 'completed' | 'evaluating'
  current_question_id?: string // Unique ID for current question
  conversation_history: InterviewAnswer[] // All Q&A pairs so far
}

export interface InterviewAnswer {
  question: string
  answer: string
  timestamp: string
  questionId?: string // Unique ID for tracking
  questionType?: 'main' | 'followup' // Type of question
  mainQuestionIndex?: number // Index of parent main question (for follow-ups)
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
  resume?: string
}

// ============================================
// NEW ARCHITECTURE: API Request/Response Types
// ============================================

/**
 * Analyze Profile Request
 * 
 * ARCHITECTURE NOTE:
 * This endpoint creates an "interview blueprint" by analyzing JD + Resume.
 * The blueprint identifies key skills, gaps, and areas to explore.
 * This is done ONCE at interview start, not per-question.
 */
export interface AnalyzeProfileRequest {
  jobDescription: string
  resume: string
  roleTitle: string
}

/**
 * Interview Blueprint
 * 
 * ARCHITECTURE DECISION:
 * Pre-computed analysis of candidate profile. This allows:
 * - Consistent question generation based on identified skills/gaps
 * - Progressive depth (start broad, go deeper)
 * - Resume-aware questioning without re-analyzing on every API call
 */
export interface InterviewBlueprint {
  key_skills: string[] // Skills to validate
  skill_gaps: string[] // Areas where candidate may lack experience
  notable_projects: string[] // Projects/experiences to explore
  focus_areas: string[] // Areas to prioritize in questions
  suggested_question_themes: string[] // Themes for question generation
}

export interface AnalyzeProfileResponse {
  blueprint: InterviewBlueprint
  success: boolean
}

/**
 * Next Question Request
 * 
 * ARCHITECTURE NOTE:
 * Unified endpoint for both main questions and follow-ups.
 * Takes interview state + last answer, returns next question.
 * 
 * WHY UNIFIED:
 * - Single source of truth for question generation logic
 * - Easier to maintain conversation context
 * - Simpler client-side state management
 */
export interface NextQuestionRequest {
  jobDescription: string
  resume: string
  roleTitle: string
  interview_state: InterviewState
  last_answer?: string // Most recent answer (for follow-up decision)
  blueprint?: InterviewBlueprint // Optional: use if available
}

/**
 * Next Question Response
 * 
 * ARCHITECTURE DECISION:
 * Returns both the question AND updated state. This ensures:
 * - Client and server stay in sync
 * - State transitions are atomic
 * - Clear indication of interview completion
 */
export interface NextQuestionResponse {
  question: string | null // null if interview complete
  question_id: string
  question_type: 'main' | 'followup'
  updated_state: InterviewState
  interview_complete: boolean
  reasoning?: string // Optional: why this question was chosen (for debugging)
}

/**
 * Final Evaluation Request
 * 
 * ARCHITECTURE NOTE:
 * Takes full interview transcript and evaluates holistically.
 * This is separate from per-question logic to allow comprehensive analysis.
 */
export interface FinalEvaluationRequest {
  jobDescription: string
  resume: string
  roleTitle: string
  conversation_history: InterviewAnswer[]
  blueprint?: InterviewBlueprint
}

// ============================================
// LEGACY TYPES (for backward compatibility)
// ============================================

export interface GenerateQuestionsRequest {
  jobDescription: string
  resume: string
  roleTitle: string
}

export interface GenerateQuestionsResponse {
  questions: string[]
  questionIds: string[]
}

export interface FollowUpRequest {
  jobDescription: string
  resume: string
  conversationHistory: Array<{
    question: string
    answer: string
  }>
  currentQuestionIndex: number
}

export interface FollowUpResponse {
  followUpQuestion: string | null
  shouldContinue: boolean
  questionId: string
}

