import type {
    NextQuestionRequest,
    NextQuestionResponse,
    InterviewState,
    InterviewBlueprint,
  } from "@/types/interview"
  import { geminiModel } from "./gemini.client"
  
  export async function nextQuestionAI(
    data: NextQuestionRequest
  ): Promise<NextQuestionResponse> {
    const {
      jobDescription,
      resume,
      roleTitle,
      interview_state,
      last_answer,
      blueprint,
    } = data
  
    const shouldAskFollowUp =
      Boolean(last_answer) &&
      interview_state.question_type === "main" &&
      interview_state.followup_count < interview_state.max_followups
  
    const transcript = interview_state.conversation_history
      .map((qa, i) => {
        const label =
          qa.questionType === "followup" ? " (Follow-up)" : ""
        return `Q${i + 1}${label}: ${qa.question}\nA${i + 1}: ${qa.answer}`
      })
      .join("\n\n")
  
    const prompt = shouldAskFollowUp
      ? buildFollowUpPrompt(
          jobDescription,
          resume,
          roleTitle,
          transcript,
          last_answer!,
          blueprint
        )
      : buildMainQuestionPrompt(
          jobDescription,
          resume,
          roleTitle,
          transcript,
          interview_state,
          blueprint
        )
  
    try {
      const result = await geminiModel.generateContent(prompt)
      const raw = extractJson(result.response.text())
      const parsed = JSON.parse(raw)
  
      const question =
        typeof parsed.question === "string" && parsed.question.trim()
          ? parsed.question.trim()
          : null
  
      const reasoning =
        typeof parsed.reasoning === "string" ? parsed.reasoning : undefined
  
      return applyStateTransition(
        interview_state,
        question,
        shouldAskFollowUp,
        reasoning
      )
    } catch (error) {
      console.error("nextQuestionAI failed:", error)
      return fallbackNextQuestion(interview_state, roleTitle)
    }
  }
  
  /* ================= helpers ================= */
  
  function applyStateTransition(
    state: InterviewState,
    question: string | null,
    isFollowUp: boolean,
    reasoning?: string
  ): NextQuestionResponse {
    const updated: InterviewState = { ...state }
  
    if (!question) {
      updated.interview_phase = "completed"
      return {
        question: null,
        question_id: "",
        question_type: "main",
        updated_state: updated,
        interview_complete: true,
        reasoning,
      }
    }
  
    if (isFollowUp) {
      updated.followup_count += 1
      updated.question_type = "followup"
      updated.current_question_id = `followup-${state.current_question_index}-${Date.now()}`
    } else {
      updated.current_question_index += 1
      updated.followup_count = 0
      updated.question_type = "main"
      updated.current_question_id = `main-${updated.current_question_index}-${Date.now()}`
    }
  
    const completed =
      updated.current_question_index >= updated.max_questions &&
      updated.question_type === "main"
  
    updated.interview_phase = completed ? "completed" : "in_progress"
  
    return {
      question,
      question_id: updated.current_question_id!,
      question_type: updated.question_type,
      updated_state: updated,
      interview_complete: completed,
      reasoning,
    }
  }
  
  function buildFollowUpPrompt(
    jd: string,
    resume: string,
    role: string,
    transcript: string,
    lastAnswer: string,
    blueprint?: InterviewBlueprint
  ): string {
    return `You are a senior ${role} interviewer.
  
  Job Description:
  ${jd}
  
  Candidate Resume:
  ${resume}
  
  Interview so far:
  ${transcript}
  
  Last answer:
  "${lastAnswer}"
  
  Decide if a follow-up question is needed.
  
  Return STRICT JSON:
  {
    "question": string | null,
    "reasoning": string
  }`
  }
  
  function buildMainQuestionPrompt(
    jd: string,
    resume: string,
    role: string,
    transcript: string,
    state: InterviewState,
    blueprint?: InterviewBlueprint
  ): string {
    return `You are a senior ${role} interviewer.
  
  Job Description:
  ${jd}
  
  Candidate Resume:
  ${resume}
  
  ${blueprint ? `Focus Areas: ${blueprint.focus_areas.join(", ")}` : ""}
  
  Interview so far:
  ${transcript || "No questions yet."}
  
  Generate question ${state.current_question_index + 1} of ${
      state.max_questions
    }.
  
  Return STRICT JSON:
  {
    "question": string,
    "reasoning": string
  }`
  }
  
  function extractJson(text: string): string {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? match[0] : "{}"
  }
  
  function fallbackNextQuestion(
    state: InterviewState,
    roleTitle: string
  ): NextQuestionResponse {
    const completed = state.current_question_index >= state.max_questions
  
    return {
      question: completed
        ? null
        : `Tell me about your experience relevant to this ${roleTitle} role.`,
      question_id: `fallback-${Date.now()}`,
      question_type: "main",
      updated_state: {
        ...state,
        interview_phase: completed ? "completed" : "in_progress",
      },
      interview_complete: completed,
      reasoning: "Fallback due to AI error",
    }
  }
  