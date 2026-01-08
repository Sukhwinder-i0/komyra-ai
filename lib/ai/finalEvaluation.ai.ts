import type {
    FinalEvaluationRequest,
    EvaluationResult,
    InterviewAnswer,
  } from "@/types/interview"
  import { geminiModel } from "./gemini.client"
  
  export async function finalEvaluationAI(
    data: FinalEvaluationRequest
  ): Promise<EvaluationResult> {
    const {
      jobDescription,
      resume,
      roleTitle,
      conversation_history,
      blueprint,
    } = data
  
    const transcript = buildTranscript(conversation_history)
  
    const prompt = `You are a senior interviewer evaluating a candidate for a ${roleTitle} role.
  
  Job Description:
  ${jobDescription}
  
  Candidate Resume:
  ${resume}
  
  ${blueprint ? `Focus Areas: ${blueprint.focus_areas.join(", ")}` : ""}
  
  Interview Transcript:
  ${transcript}
  
  Return STRICT JSON only:
  {
    "alignment_percentage": 0,
    "technical_score": 0,
    "problem_solving_score": 0,
    "communication_score": 0,
    "strengths": [],
    "weaknesses": [],
    "final_verdict": "Fit" | "Maybe" | "Reject",
    "summary": ""
  }`
  
    try {
      const result = await geminiModel.generateContent(prompt)
      const text = result.response.text()
  
      const parsed = JSON.parse(extractJson(text))
  
      return sanitizeEvaluation(parsed)
    } catch (error) {
      console.error("finalEvaluationAI failed:", error)
      return getFallbackEvaluation(conversation_history.length)
    }
  }
  
  /* ---------- helpers ---------- */
  
  function buildTranscript(history: InterviewAnswer[]): string {
    return history
      .map(
        (qa, i) =>
          `Q${i + 1}${qa.questionType === "followup" ? " (Follow-up)" : ""}: ${
            qa.question
          }\nA${i + 1}: ${qa.answer}`
      )
      .join("\n\n")
  }
  
  function extractJson(text: string): string {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? match[0] : "{}"
  }
  
  function sanitizeEvaluation(parsed: any): EvaluationResult {
    return {
      alignment_percentage: clamp(parsed.alignment_percentage, 0, 100),
      technical_score: clamp(parsed.technical_score, 0, 10),
      problem_solving_score: clamp(parsed.problem_solving_score, 0, 10),
      communication_score: clamp(parsed.communication_score, 0, 10),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      final_verdict: ["Fit", "Maybe", "Reject"].includes(parsed.final_verdict)
        ? parsed.final_verdict
        : "Maybe",
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "Evaluation completed.",
    }
  }
  
  function clamp(value: any, min: number, max: number): number {
    const num = Number(value)
    if (Number.isNaN(num)) return min
    return Math.min(max, Math.max(min, num))
  }
  
  function getFallbackEvaluation(count: number): EvaluationResult {
    return {
      alignment_percentage: 65,
      technical_score: 7,
      problem_solving_score: 6,
      communication_score: 7,
      strengths: ["Completed interview", "Engaged in discussion"],
      weaknesses: ["Automated evaluation incomplete"],
      final_verdict: "Maybe",
      summary: `The candidate answered ${count} questions. Manual review is recommended.`,
    }
  }
  