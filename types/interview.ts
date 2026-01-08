// CORE INTERVIEW TYPES

export interface InterviewSetup {
  roleTitle: string
  jobDescription: string
  resume?: string
  questions?: string[]
  createdAt: string
  useDynamicQuestions?: boolean
  interviewBlueprint?: InterviewBlueprint
}

export interface InterviewState {
  current_question_index: number
  question_type: "main" | "followup"
  followup_count: number
  max_questions: number
  max_followups: number
  interview_phase: "initializing" | "in_progress" | "completed" | "evaluating"
  current_question_id?: string
  conversation_history: InterviewAnswer[]
}

export interface InterviewAnswer {
  question: string
  answer: string
  timestamp: string
  questionId?: string
  questionType?: "main" | "followup"
  mainQuestionIndex?: number
}

//BLUEPRINT & ANALYSIS

export interface InterviewBlueprint {
  key_skills: string[]
  skill_gaps: string[]
  notable_projects: string[]
  focus_areas: string[]
  suggested_question_themes: string[]
}

// API CONTRACTS

export interface AnalyzeProfileRequest {
  jobDescription: string
  resume: string
  roleTitle: string
}



export interface AnalyzeProfileResponse {
  success: boolean
  blueprint: InterviewBlueprint
}

export interface NextQuestionRequest {
  jobDescription: string
  resume: string
  roleTitle: string
  interview_state: InterviewState
  last_answer?: string
  blueprint?: InterviewBlueprint
}

export interface NextQuestionResponse {
  question: string | null
  question_id: string
  question_type: "main" | "followup"
  updated_state: InterviewState
  interview_complete: boolean
  reasoning?: string
}

// FINAL EVALUATION

export interface EvaluationRequest {
  jobDescription: string
  questions: string[]
  answers: InterviewAnswer[]
  resume?: string
}


export interface EvaluationResult {
  alignment_percentage: number
  technical_score: number
  problem_solving_score: number
  communication_score: number
  strengths: string[]
  weaknesses: string[]
  final_verdict: "Fit" | "Maybe" | "Reject"
  summary: string
}

export interface FinalEvaluationRequest {
  jobDescription: string
  resume: string
  roleTitle: string
  conversation_history: InterviewAnswer[]
  blueprint?: InterviewBlueprint
}
