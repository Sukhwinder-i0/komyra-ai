import { NextRequest, NextResponse } from "next/server"
import type {
  AnalyzeProfileRequest,
  AnalyzeProfileResponse,
} from "@/types/interview"
import {
  analyzeProfileAI,
  getFallbackBlueprint,
} from "@/lib/ai/analyzeProfile.ai"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeProfileRequest
    const { jobDescription, resume, roleTitle } = body

    if (!jobDescription || !resume || !roleTitle) {
      return NextResponse.json(
        {
          success: false,
          blueprint: getFallbackBlueprint(),
        } as AnalyzeProfileResponse,
        { status: 400 }
      )
    }

    const blueprint = await analyzeProfileAI({
      jobDescription,
      resume,
      roleTitle,
    })

    return NextResponse.json({
      success: true,
      blueprint,
    } as AnalyzeProfileResponse)
  } catch (error) {
    console.error("Analyze profile route error:", error)

    return NextResponse.json(
      {
        success: false,
        blueprint: getFallbackBlueprint(),
      } as AnalyzeProfileResponse,
      { status: 500 }
    )
  }
}
