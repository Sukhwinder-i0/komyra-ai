import { NextRequest, NextResponse } from "next/server"
import type {
  EvaluationRequest,
  EvaluationResult,
} from "@/types/interview"
import { evaluateCandidateAI } from "@/lib/ai/evaluateCandidate.ai"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EvaluationRequest
    const { jobDescription, questions, answers } = body

    if (!jobDescription || !questions?.length || !answers?.length) {
      return NextResponse.json(
        { error: "Invalid evaluation request" },
        { status: 400 }
      )
    }

    const evaluation = await evaluateCandidateAI(body)

    return NextResponse.json(evaluation satisfies EvaluationResult)
  } catch (error) {
    console.error("Evaluation route error:", error)

    return NextResponse.json(
      { error: "Failed to evaluate candidate" },
      { status: 500 }
    )
  }
}
