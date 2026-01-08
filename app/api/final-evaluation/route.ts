import { NextRequest, NextResponse } from "next/server"
import type {
  FinalEvaluationRequest,
  EvaluationResult,
} from "@/types/interview"
import { finalEvaluationAI } from "@/lib/ai/finalEvaluation.ai"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinalEvaluationRequest
    const { jobDescription, resume, roleTitle, conversation_history } = body

    if (
      !jobDescription ||
      !resume ||
      !roleTitle ||
      !conversation_history?.length
    ) {
      return NextResponse.json(
        { error: "Invalid final evaluation request" },
        { status: 400 }
      )
    }

    const evaluation = await finalEvaluationAI(body)

    return NextResponse.json(evaluation satisfies EvaluationResult)
  } catch (error) {
    console.error("Final evaluation route error:", error)

    return NextResponse.json(
      { error: "Failed to evaluate interview" },
      { status: 500 }
    )
  }
}
