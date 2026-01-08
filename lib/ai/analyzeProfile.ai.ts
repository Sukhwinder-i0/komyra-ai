import type {
    AnalyzeProfileRequest,
    InterviewBlueprint,
  } from "@/types/interview"
  import { geminiModel } from "./gemini.client"
  
  export async function analyzeProfileAI(
    data: AnalyzeProfileRequest
  ): Promise<InterviewBlueprint> {
    const { jobDescription, resume, roleTitle } = data
  
    const prompt = `You are an expert technical recruiter analyzing a candidate for a ${roleTitle} role.
  
  Job Description:
  ${jobDescription}
  
  Candidate Resume:
  ${resume}
  
  Return STRICT JSON only:
  {
    "key_skills": [],
    "skill_gaps": [],
    "notable_projects": [],
    "focus_areas": [],
    "suggested_question_themes": []
  }`
  
    try {
      const result = await geminiModel.generateContent(prompt)
      const text = result.response.text()
  
      const json = extractJson(text)
      const parsed = JSON.parse(json)
  
      if (!isValidBlueprint(parsed)) {
        throw new Error("Invalid blueprint structure")
      }
  
      return parsed
    } catch (error) {
      console.error("analyzeProfileAI failed:", error)
      return getFallbackBlueprint()
    }
  }
  
  // helpers
  
  function extractJson(text: string): string {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? match[0] : "{}"
  }
  
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
  
  export function getFallbackBlueprint(): InterviewBlueprint {
    return {
      key_skills: ["Technical skills", "Problem-solving"],
      skill_gaps: ["Experience gaps"],
      notable_projects: ["Previous work"],
      focus_areas: ["Technical depth", "Communication"],
      suggested_question_themes: ["Projects", "Challenges"],
    }
  }
  