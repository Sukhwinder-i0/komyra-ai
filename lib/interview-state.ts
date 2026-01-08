import type { InterviewState, InterviewAnswer } from "@/types/interview"

export function createInitialInterviewState(
  maxQuestions = 7,
  maxFollowups = 2
): InterviewState {
  return {
    current_question_index: 0,
    question_type: "main",
    followup_count: 0,
    max_questions: maxQuestions,
    max_followups: maxFollowups,
    interview_phase: "initializing",
    current_question_id: undefined,
    conversation_history: [],
  }
}

export function recordAnswer(
  state: InterviewState,
  question: string,
  answer: string,
  questionId?: string
): InterviewState {
  const entry: InterviewAnswer = {
    question,
    answer,
    timestamp: new Date().toISOString(),
    questionId: questionId ?? state.current_question_id,
    questionType: state.question_type,
    mainQuestionIndex:
      state.question_type === "followup"
        ? state.current_question_index
        : undefined,
  }

  return {
    ...state,
    conversation_history: [...state.conversation_history, entry],
  }
}

export function syncStateFromServer(
  local: InterviewState,
  server: InterviewState
): InterviewState {
  return {
    ...server,
    conversation_history: local.conversation_history,
  }
}

export function canContinueInterview(state: InterviewState): boolean {
  if (state.interview_phase === "completed") return false
  return state.current_question_index < state.max_questions
}

export function getInterviewProgress(state: InterviewState): number {
  if (!state.max_questions) return 0
  const progress = ((state.current_question_index + 1) / state.max_questions) * 100
  return Math.min(100, Math.round(progress))
}

export function getQuestionContext(state: InterviewState) {
  return {
    questionNumber: state.current_question_index + 1,
    totalQuestions: state.max_questions,
    followupCount: state.followup_count,
    maxFollowups: state.max_followups,
    isFollowUp: state.question_type === "followup",
  }
}
