import { NextRequest, NextResponse } from 'next/server'
import type { AnalyzeProfileRequest, AnalyzeProfileResponse, InterviewBlueprint } from '@/types/interview'

/**
 * Analyze Profile API Route
 * 
 * ARCHITECTURE PURPOSE:
 * This endpoint creates an "interview blueprint" by analyzing the job description
 * and candidate resume. The blueprint identifies:
 * - Key skills to validate
 * - Skill gaps to explore
 * - Notable projects/experiences
 * - Focus areas for questioning
 * 
 * WHY THIS EXISTS:
 * - Pre-computes analysis ONCE at interview start
 * - Provides consistent context for all subsequent questions
 * - Avoids re-analyzing JD+Resume on every API call
 * - Enables progressive question depth (start broad, go deeper)
 * 
 * POST /api/analyze-profile
 */
export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeProfileRequest = await request.json()
    const { jobDescription, resume, roleTitle } = body

    // Validate input
    if (!jobDescription || !resume || !roleTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: jobDescription, resume, or roleTitle' },
        { status: 400 }
      )
    }

    // Generate blueprint using Gemini
    const blueprint = await analyzeProfileWithGemini({
      jobDescription,
      resume,
      roleTitle,
    })

    return NextResponse.json({
      blueprint,
      success: true,
    } as AnalyzeProfileResponse)
  } catch (error) {
    console.error('Analyze profile error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze profile',
        success: false,
        blueprint: getFallbackBlueprint(),
      } as AnalyzeProfileResponse,
      { status: 500 }
    )
  }
}

/**
 * Analyze Profile with Gemini
 * 
 * ARCHITECTURE DECISION:
 * Uses structured JSON output from Gemini. The prompt explicitly requests
 * JSON format and we validate/parse it. If parsing fails, we return
 * a fallback blueprint to ensure the interview can still proceed.
 */
async function analyzeProfileWithGemini(
  data: AnalyzeProfileRequest
): Promise<InterviewBlueprint> {
  const { jobDescription, resume, roleTitle } = data

  const { GoogleGenerativeAI } = require('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

  const prompt = `You are an expert technical recruiter analyzing a candidate for a ${roleTitle} position.

Job Description:
${jobDescription}

Candidate Resume:
${resume}

Analyze the candidate's profile and create an interview blueprint. Identify:

1. KEY SKILLS: Technical skills mentioned in both JD and resume that should be validated
2. SKILL GAPS: Skills required by JD but not clearly present in resume
3. NOTABLE PROJECTS: Specific projects/experiences from resume worth exploring
4. FOCUS AREAS: 3-5 key areas to prioritize during the interview
5. QUESTION THEMES: Suggested themes for generating questions (e.g., "React experience", "System design", "Problem-solving")

Return STRICT JSON only (no markdown, no code blocks, no explanations):
{
  "key_skills": ["skill1", "skill2", ...],
  "skill_gaps": ["gap1", "gap2", ...],
  "notable_projects": ["project1", "project2", ...],
  "focus_areas": ["area1", "area2", ...],
  "suggested_question_themes": ["theme1", "theme2", ...]
}

Ensure all arrays contain strings. Return only valid JSON.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text().trim()

    // Clean and parse JSON response
    const cleanedText = cleanJsonResponse(text)
    const parsed = JSON.parse(cleanedText)

    // Validate structure
    if (!isValidBlueprint(parsed)) {
      throw new Error('Invalid blueprint structure')
    }

    return parsed as InterviewBlueprint
  } catch (error) {
    console.error('Error parsing blueprint from Gemini:', error)
    return getFallbackBlueprint()
  }
}

/**
 * Clean JSON Response
 * 
 * ARCHITECTURE NOTE:
 * Gemini sometimes returns JSON wrapped in markdown code blocks.
 * This utility extracts pure JSON for parsing.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  
  // Remove markdown code blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  }
  
  // Extract JSON object if embedded in text
  if (cleaned.includes('{')) {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      cleaned = match[0]
    }
  }
  
  return cleaned.trim()
}

/**
 * Validate Blueprint Structure
 * 
 * ARCHITECTURE DECISION:
 * Type validation ensures we have the expected structure before using it.
 * This prevents runtime errors and provides clear fallback behavior.
 */
function isValidBlueprint(obj: any): obj is InterviewBlueprint {
  return (
    obj &&
    Array.isArray(obj.key_skills) &&
    Array.isArray(obj.skill_gaps) &&
    Array.isArray(obj.notable_projects) &&
    Array.isArray(obj.focus_areas) &&
    Array.isArray(obj.suggested_question_themes)
  )
}

/**
 * Fallback Blueprint
 * 
 * ARCHITECTURE DECISION:
 * If Gemini fails or returns invalid data, we provide a generic blueprint.
 * This ensures the interview can still proceed, even if analysis is imperfect.
 */
function getFallbackBlueprint(): InterviewBlueprint {
  return {
    key_skills: ['Technical skills', 'Problem-solving', 'Communication'],
    skill_gaps: ['Experience gaps to explore'],
    notable_projects: ['Previous work experience'],
    focus_areas: ['Technical competency', 'Cultural fit', 'Problem-solving approach'],
    suggested_question_themes: ['Technical experience', 'Challenges faced', 'Project details'],
  }
}

