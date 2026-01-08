import { NextRequest, NextResponse } from "next/server"
import type {
  NextQuestionRequest,
  NextQuestionResponse,
} from "@/types/interview"
import { nextQuestionAI } from "@/lib/ai/nextQuestion.ai"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NextQuestionRequest
    const { jobDescription, resume, roleTitle, interview_state } = body

    if (!jobDescription || !resume || !roleTitle || !interview_state) {
      return NextResponse.json(
        { error: "Invalid next-question request" },
        { status: 400 }
      )
    }

    if (interview_state.interview_phase === "completed") {
      return NextResponse.json({
        question: null,
        question_id: "",
        question_type: "main",
        updated_state: interview_state,
        interview_complete: true,
      } satisfies NextQuestionResponse)
    }

    const response = await nextQuestionAI(body)

    return NextResponse.json(response)
  } catch (error) {
    console.error("Next-question route error:", error)
    return NextResponse.json(
      { error: "Failed to generate next question" },
      { status: 500 }
    )
  }
}
